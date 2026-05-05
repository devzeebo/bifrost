package postgres

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAESEncryptionService(t *testing.T) {
	t.Run("creates service with valid key", func(t *testing.T) {
		key := make([]byte, 32)
		for i := range key {
			key[i] = byte(i)
		}

		service, err := NewAESEncryptionService(key)
		require.NoError(t, err)
		assert.NotNil(t, service)
	})

	t.Run("fails with invalid key length", func(t *testing.T) {
		key := make([]byte, 16) // Wrong length for AES-256

		service, err := NewAESEncryptionService(key)
		require.Error(t, err)
		assert.Nil(t, service)
		assert.Contains(t, err.Error(), "key must be 32 bytes")
	})

	t.Run("encrypts and decrypts successfully", func(t *testing.T) {
		key := make([]byte, 32)
		for i := range key {
			key[i] = byte(i)
		}

		service, err := NewAESEncryptionService(key)
		require.NoError(t, err)

		plaintext := "Hello, World!"
		
		// Encrypt
		ciphertext, err := service.Encrypt(plaintext)
		require.NoError(t, err)
		assert.NotEqual(t, plaintext, ciphertext)
		assert.Contains(t, ciphertext, encryptedPrefix)

		// Decrypt
		decrypted, err := service.Decrypt(ciphertext)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("decrypts without prefix", func(t *testing.T) {
		key := make([]byte, 32)
		for i := range key {
			key[i] = byte(i)
		}

		service, err := NewAESEncryptionService(key)
		require.NoError(t, err)

		plaintext := "Hello, World!"
		
		// Encrypt
		ciphertext, err := service.Encrypt(plaintext)
		require.NoError(t, err)

		// Remove prefix
		encoded := ciphertext[len(encryptedPrefix):]

		// Decrypt without prefix
		decrypted, err := service.Decrypt(encoded)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("fails to decrypt invalid ciphertext", func(t *testing.T) {
		key := make([]byte, 32)
		for i := range key {
			key[i] = byte(i)
		}

		service, err := NewAESEncryptionService(key)
		require.NoError(t, err)

		invalidCiphertext := "invalid:ciphertext"
		
		// Decrypt
		_, err = service.Decrypt(invalidCiphertext)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "base64 decode failed")
	})

	t.Run("fails to decrypt wrong key", func(t *testing.T) {
		key1 := make([]byte, 32)
		key2 := make([]byte, 32)
		for i := range key1 {
			key1[i] = byte(i)
			key2[i] = byte(31 - i) // Different key
		}

		service1, err := NewAESEncryptionService(key1)
		require.NoError(t, err)

		service2, err := NewAESEncryptionService(key2)
		require.NoError(t, err)

		plaintext := "Hello, World!"
		
		// Encrypt with service1
		ciphertext, err := service1.Encrypt(plaintext)
		require.NoError(t, err)

		// Decrypt with service2 (different key)
		_, err = service2.Decrypt(ciphertext)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "decryption failed")
	})
}