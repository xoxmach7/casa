/**
 * Normalizes a phone number string to a standard format: +7XXXXXXXXXX
 * Strips all non-digit characters and ensures it starts with +7 or 8 (converted to +7).
 * @param phone Raw phone number string from frontend
 * @returns Normalized phone number string
 */
export const normalizePhone = (phone: string): string => {
    if (!phone) return phone;

    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Handle Kazakhstan/Russia prefixes
    if (digits.startsWith('8')) {
        digits = '7' + digits.substring(1);
    } else if (digits.startsWith('7')) {
        // Already starts with 7
    } else if (digits.length === 10) {
        // Assume it's a 10-digit number without prefix
        digits = '7' + digits;
    }

    // Ensure we have exactly 11 digits (7 + 10 digits)
    // If it's longer or shorter, we return it as is but prefixed with +
    // depending on the input, but the standard case is 11 digits.
    if (digits.length === 11) {
        return '+' + digits;
    }

    // Fallback: if it's not a standard length, just prefix with + if not present
    return phone.startsWith('+') ? phone : '+' + digits;
};
