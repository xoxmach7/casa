import { useCallback } from 'react';
import { formatPhoneKZ, parsePhoneRaw, isPhoneComplete } from '@/lib/formatters';

interface PhoneInputProps {
  /** Formatted display value (managed by parent via onChange) */
  value: string;
  /** Called with formatted display value */
  onChange: (displayValue: string) => void;
  /** Optional error message */
  error?: string;
  /** CSS class for the input element */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Unified Kazakhstan phone input with auto-formatting.
 *
 * Display: +7 (7XX) XXX-XX-XX
 * Stored:  +77XXXXXXXXX (use parsePhoneRaw to get raw value)
 * Validates via isPhoneComplete.
 */
const PhoneInput = ({
  value,
  onChange,
  error,
  className = 'casa-input',
  placeholder = '+7 (7XX) XXX-XX-XX',
}: PhoneInputProps) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(formatPhoneKZ(e.target.value));
    },
    [onChange],
  );

  return (
    <div className="space-y-1">
      <input
        type="tel"
        inputMode="tel"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        autoComplete="tel"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default PhoneInput;

/** Validate phone and return error string or empty */
export const validatePhone = (displayValue: string): string => {
  if (!displayValue.trim()) return 'Введите номер телефона';
  if (!isPhoneComplete(displayValue)) return 'Введите полный номер: +7 (7XX) XXX-XX-XX';
  return '';
};
