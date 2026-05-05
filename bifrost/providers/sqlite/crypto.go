package sqlite

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"

	"github.com/devzeebo/bifrost/core"
)

const encryptedPrefix = "encrypted:"

// AESEncryptionService implements core.EncryptionService using AES-256-GCM.
type AESEncryptionService struct {
	gcm cipher.AEAD
}

// NewAESEncryptionService creates a new AES-256-GCM encryption service.
// The key must be exactly 32 bytes for AES-256.
func NewAESEncryptionService(key []byte) (*AESEncryptionService, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("%w: key must be 32 bytes for AES-256, got %d bytes", core.ErrInvalidKey, len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", core.ErrInvalidKey, err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", core.ErrInvalidKey, err)
	}

	return &AESEncryptionService{
		gcm: gcm,
	}, nil
}

// Encrypt encrypts the plaintext and returns a ciphertext with "encrypted:" prefix.
func (s *AESEncryptionService) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, s.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := s.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	encoded := base64.StdEncoding.EncodeToString(ciphertext)

	return encryptedPrefix + encoded, nil
}

// Decrypt decrypts a ciphertext (with or without "encrypted:" prefix) and returns the plaintext.
func (s *AESEncryptionService) Decrypt(ciphertext string) (string, error) {
	// Strip the prefix if present
	encoded := ciphertext
	if len(ciphertext) > len(encryptedPrefix) && ciphertext[:len(encryptedPrefix)] == encryptedPrefix {
		encoded = ciphertext[len(encryptedPrefix):]
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("%w: base64 decode failed: %v", core.ErrDecryptionFailed, err)
	}

	nonceSize := s.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("%w: ciphertext too short", core.ErrDecryptionFailed)
	}

	nonce, encryptedData := data[:nonceSize], data[nonceSize:]
	plaintext, err := s.gcm.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return "", fmt.Errorf("%w: %v", core.ErrDecryptionFailed, err)
	}

	return string(plaintext), nil
}
