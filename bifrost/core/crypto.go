package core

import "errors"

// EncryptionService provides encryption and decryption for sensitive data.
type EncryptionService interface {
	// Encrypt encrypts the plaintext and returns a ciphertext with "encrypted:" prefix.
	Encrypt(plaintext string) (string, error)
	// Decrypt decrypts a ciphertext (with or without "encrypted:" prefix) and returns the plaintext.
	Decrypt(ciphertext string) (string, error)
}

// ErrInvalidKey is returned when the encryption key is invalid.
var ErrInvalidKey = errors.New("invalid encryption key")

// ErrDecryptionFailed is returned when decryption fails.
var ErrDecryptionFailed = errors.New("decryption failed")
