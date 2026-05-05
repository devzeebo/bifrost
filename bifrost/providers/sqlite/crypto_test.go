package sqlite

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAESEncryptionService(t *testing.T) {
	t.Run("encrypts and decrypts plaintext successfully", func(t *testing.T) {
		tc := newCryptoTestContext(t)

		// Given
		tc.aes_encryption_service_with_key()
		tc.plaintext_value("sensitive-api-key-12345")

		// When
		tc.value_is_encrypted()
		tc.value_is_decrypted()

		// Then
		tc.decrypted_value_matches_original()
		tc.encrypted_value_has_prefix()
	})

	t.Run("produces different ciphertext for same plaintext", func(t *testing.T) {
		tc := newCryptoTestContext(t)

		// Given
		tc.aes_encryption_service_with_key()
		tc.plaintext_value("same-value")

		// When
		tc.value_is_encrypted_twice()

		// Then
		tc.ciphertexts_are_different()
		tc.both_can_be_decrypted()
	})

	t.Run("returns error when decrypting invalid ciphertext", func(t *testing.T) {
		tc := newCryptoTestContext(t)

		// Given
		tc.aes_encryption_service_with_key()
		tc.invalid_ciphertext("not-valid-encrypted-data")

		// When
		tc.invalid_value_is_decrypted()

		// Then
		tc.decryption_error_is_returned()
	})

	t.Run("returns error when decrypting value without prefix", func(t *testing.T) {
		tc := newCryptoTestContext(t)

		// Given
		tc.aes_encryption_service_with_key()
		tc.unprefixed_ciphertext("cmF3LWRhdGEtd2l0aG91dC1wcmVmaXg=")

		// When
		tc.unprefixed_value_is_decrypted()

		// Then
		tc.decryption_error_is_returned()
	})

	t.Run("returns error when key is invalid", func(t *testing.T) {
		tc := newCryptoTestContext(t)

		// Given
		tc.invalid_key()

		// When
		tc.service_is_created()

		// Then
		tc.creation_error_is_returned()
	})
}

// --- Test Context ---

type cryptoTestContext struct {
	t *testing.T

	plaintext    string
	ciphertext   string
	ciphertext2  string
	decrypted    string
	invalidValue string

	service *AESEncryptionService
	err     error
}

func newCryptoTestContext(t *testing.T) *cryptoTestContext {
	t.Helper()
	return &cryptoTestContext{t: t}
}

// --- Given ---

func (tc *cryptoTestContext) aes_encryption_service_with_key() {
	tc.t.Helper()
	key := make([]byte, 32) // 32 bytes for AES-256
	for i := range key {
		key[i] = byte(i)
	}
	tc.service, tc.err = NewAESEncryptionService(key)
	require.NoError(tc.t, tc.err, "failed to create encryption service")
}

func (tc *cryptoTestContext) plaintext_value(value string) {
	tc.t.Helper()
	tc.plaintext = value
}

func (tc *cryptoTestContext) invalid_ciphertext(value string) {
	tc.t.Helper()
	tc.invalidValue = value
}

func (tc *cryptoTestContext) unprefixed_ciphertext(value string) {
	tc.t.Helper()
	tc.invalidValue = value
}

func (tc *cryptoTestContext) invalid_key() {
	tc.t.Helper()
	// Key with wrong length (not 32 bytes)
	tc.service, tc.err = NewAESEncryptionService([]byte("too-short"))
}

// --- When ---

func (tc *cryptoTestContext) value_is_encrypted() {
	tc.t.Helper()
	tc.ciphertext, tc.err = tc.service.Encrypt(tc.plaintext)
	require.NoError(tc.t, tc.err, "encryption failed")
}

func (tc *cryptoTestContext) value_is_encrypted_twice() {
	tc.t.Helper()
	var err error
	tc.ciphertext, err = tc.service.Encrypt(tc.plaintext)
	require.NoError(tc.t, err, "first encryption failed")
	tc.ciphertext2, err = tc.service.Encrypt(tc.plaintext)
	require.NoError(tc.t, err, "second encryption failed")
}

func (tc *cryptoTestContext) value_is_decrypted() {
	tc.t.Helper()
	tc.decrypted, tc.err = tc.service.Decrypt(tc.ciphertext)
	require.NoError(tc.t, tc.err, "decryption failed")
}

func (tc *cryptoTestContext) invalid_value_is_decrypted() {
	tc.t.Helper()
	tc.decrypted, tc.err = tc.service.Decrypt(tc.invalidValue)
}

func (tc *cryptoTestContext) unprefixed_value_is_decrypted() {
	tc.t.Helper()
	tc.decrypted, tc.err = tc.service.Decrypt(tc.invalidValue)
}

func (tc *cryptoTestContext) service_is_created() {
	tc.t.Helper()
	// Service creation happens in the given step
}

// --- Then ---

func (tc *cryptoTestContext) decrypted_value_matches_original() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.plaintext, tc.decrypted, "decrypted value should match original plaintext")
}

func (tc *cryptoTestContext) encrypted_value_has_prefix() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.ciphertext, "encrypted:", "ciphertext should have encrypted: prefix")
}

func (tc *cryptoTestContext) ciphertexts_are_different() {
	tc.t.Helper()
	assert.NotEqual(tc.t, tc.ciphertext, tc.ciphertext2, "two encryptions of same value should produce different ciphertext due to random nonce")
}

func (tc *cryptoTestContext) both_can_be_decrypted() {
	tc.t.Helper()
	decrypted1, err := tc.service.Decrypt(tc.ciphertext)
	require.NoError(tc.t, err, "failed to decrypt first ciphertext")
	assert.Equal(tc.t, tc.plaintext, decrypted1, "first decrypted value should match original")

	decrypted2, err := tc.service.Decrypt(tc.ciphertext2)
	require.NoError(tc.t, err, "failed to decrypt second ciphertext")
	assert.Equal(tc.t, tc.plaintext, decrypted2, "second decrypted value should match original")
}

func (tc *cryptoTestContext) decryption_error_is_returned() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err, "decryption should fail for invalid ciphertext")
	assert.Empty(tc.t, tc.decrypted, "decrypted value should be empty on error")
}

func (tc *cryptoTestContext) creation_error_is_returned() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err, "service creation should fail with invalid key")
	assert.Nil(tc.t, tc.service, "service should be nil on error")
}
