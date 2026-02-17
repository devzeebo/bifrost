package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/golang-jwt/jwt/v5"
)

// context keys for admin UI authentication
type adminContextKey string

const (
	accountIDKey adminContextKey = "admin_account_id"
	patIDKey     adminContextKey = "admin_pat_id"
	usernameKey  adminContextKey = "admin_username"
	rolesKey     adminContextKey = "admin_roles"
)

// AdminClaims represents the JWT claims for admin UI authentication.
type AdminClaims struct {
	AccountID string `json:"sub"`
	PATID     string `json:"pat"`
	jwt.RegisteredClaims
}

// AuthConfig holds configuration for admin authentication.
type AuthConfig struct {
	SigningKey     []byte
	TokenExpiry    time.Duration
	CookieName     string
	CookieSecure   bool
	CookieSameSite http.SameSite
}

// DefaultAuthConfig returns the default authentication configuration.
// Note: SigningKey is intentionally nil and MUST be set before use.
// For production deployments, load the key from a secure configuration source
// (e.g., environment variable ADMIN_JWT_SIGNING_KEY as base64-encoded 32-byte value).
// The key must be persistent across server restarts and shared across all instances
// to maintain session validity. Use GenerateSigningKey() to create a new random key.
func DefaultAuthConfig() *AuthConfig {
	return &AuthConfig{
		TokenExpiry:    12 * time.Hour, // SOC 2 CC6.1 requires max 12-hour absolute session lifetime
		CookieName:     "admin_token",
		CookieSecure:   true,
		CookieSameSite: http.SameSiteStrictMode,
	}
}

// GenerateSigningKey creates a new random signing key.
func GenerateSigningKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	return key, nil
}

// AccountIDFromContext extracts the account ID from the request context.
func AccountIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(accountIDKey).(string)
	return id, ok
}

// PATIDFromContext extracts the PAT ID from the request context.
func PATIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(patIDKey).(string)
	return id, ok
}

// UsernameFromContext extracts the username from the request context.
func UsernameFromContext(ctx context.Context) (string, bool) {
	username, ok := ctx.Value(usernameKey).(string)
	return username, ok
}

// RolesFromContext extracts the roles map from the request context.
func RolesFromContext(ctx context.Context) (map[string]string, bool) {
	roles, ok := ctx.Value(rolesKey).(map[string]string)
	return roles, ok
}

// GenerateJWT creates a signed JWT token for the given account and PAT.
// Returns an error if SigningKey is not configured.
func GenerateJWT(cfg *AuthConfig, accountID, patID string) (string, error) {
	if len(cfg.SigningKey) == 0 {
		return "", errors.New("JWT signing key not configured")
	}

	claims := AdminClaims{
		AccountID: accountID,
		PATID:     patID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(cfg.TokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(cfg.SigningKey)
}

// ValidateJWT parses and validates a JWT token string.
func ValidateJWT(cfg *AuthConfig, tokenString string) (*AdminClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &AdminClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Method.Alg())
		}
		return cfg.SigningKey, nil
	})
	if err != nil {
		return nil, fmt.Errorf("parse JWT: %w", err)
	}

	claims, ok := token.Claims.(*AdminClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims type: expected *AdminClaims, got %T", token.Claims)
	}

	return claims, nil
}

// CheckPATStatus verifies that a PAT is still active by looking it up in the projection store.
// It uses the same lookup mechanism as the API's PAT authentication.
func CheckPATStatus(ctx context.Context, projectionStore core.ProjectionStore, patID string) (*projectors.AccountLookupEntry, error) {
	// Look up the key hash from PAT ID reverse lookup
	var keyHash string
	if err := projectionStore.Get(ctx, "_admin", "account_lookup", "pat:"+patID, &keyHash); err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return nil, ErrPATRevoked
		}
		return nil, fmt.Errorf("checking PAT status for %s: lookup key hash: %w", patID, err)
	}

	// Look up the account entry by key hash
	var entry projectors.AccountLookupEntry
	if err := projectionStore.Get(ctx, "_admin", "account_lookup", keyHash, &entry); err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return nil, ErrPATRevoked
		}
		return nil, fmt.Errorf("checking PAT status for %s: lookup account entry: %w", patID, err)
	}

	if entry.Status == "suspended" {
		return nil, ErrAccountSuspended
	}

	return &entry, nil
}

// Authentication errors
var (
	ErrNoToken        = errors.New("no authentication token provided")
	ErrInvalidToken   = errors.New("invalid authentication token")
	ErrTokenExpired   = errors.New("authentication token expired")
	ErrPATRevoked     = errors.New("PAT has been revoked")
	ErrAccountSuspended = errors.New("account is suspended")
)

// AuthMiddleware returns HTTP middleware that authenticates admin UI requests via JWT cookie.
func AuthMiddleware(cfg *AuthConfig, projectionStore core.ProjectionStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(cfg.CookieName)
			if err != nil {
				redirectToLogin(w, r, cfg)
				return
			}

			claims, err := ValidateJWT(cfg, cookie.Value)
			if err != nil {
				redirectToLogin(w, r, cfg)
				return
			}

			// Check that the PAT is still active
			entry, err := CheckPATStatus(r.Context(), projectionStore, claims.PATID)
			if err != nil {
				redirectToLogin(w, r, cfg)
				return
			}

			// Set values in context for downstream handlers
			ctx := r.Context()
			ctx = context.WithValue(ctx, accountIDKey, claims.AccountID)
			ctx = context.WithValue(ctx, patIDKey, claims.PATID)
			ctx = context.WithValue(ctx, usernameKey, entry.Username)
			ctx = context.WithValue(ctx, rolesKey, entry.Roles)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// redirectToLogin clears the auth cookie and redirects to the login page.
func redirectToLogin(w http.ResponseWriter, r *http.Request, cfg *AuthConfig) {
	// Clear the cookie using the same attributes as ClearAuthCookie
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    "",
		Path:     "/admin",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSite,
	})

	// Redirect to login page
	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

// SetAuthCookie sets the authentication cookie with the JWT token.
func SetAuthCookie(w http.ResponseWriter, cfg *AuthConfig, token string) {
	expiry := time.Now().Add(cfg.TokenExpiry)
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    token,
		Path:     "/admin",
		MaxAge:   int(cfg.TokenExpiry.Seconds()),
		Expires:  expiry,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSite,
	})
}

// ClearAuthCookie clears the authentication cookie.
func ClearAuthCookie(w http.ResponseWriter, cfg *AuthConfig) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    "",
		Path:     "/admin",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSite,
	})
}

// ValidatePAT validates a PAT string and returns the associated account entry and PAT ID.
// This is used during login to validate the PAT before generating a JWT.
func ValidatePAT(ctx context.Context, projectionStore core.ProjectionStore, token string) (*projectors.AccountLookupEntry, string, error) {
	// Decode the raw key from base64url
	rawBytes, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, "", ErrInvalidToken
	}

	// SHA-256 hash the raw bytes and encode as base64url
	h := sha256.Sum256(rawBytes)
	keyHash := base64.RawURLEncoding.EncodeToString(h[:])

	// Look up in account_lookup projection
	var entry projectors.AccountLookupEntry
	err = projectionStore.Get(ctx, "_admin", "account_lookup", keyHash, &entry)
	if err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return nil, "", ErrInvalidToken
		}
		return nil, "", fmt.Errorf("validate PAT: lookup account entry: %w", err)
	}

	if entry.Status == "suspended" {
		return nil, "", ErrAccountSuspended
	}

	// Look up PAT ID from keyHash reverse lookup
	var patID string
	if err := projectionStore.Get(ctx, "_admin", "account_lookup", "keyhash_pat:"+keyHash, &patID); err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return nil, "", ErrInvalidToken
		}
		return nil, "", fmt.Errorf("validate PAT: lookup PAT ID: %w", err)
	}

	return &entry, patID, nil
}
