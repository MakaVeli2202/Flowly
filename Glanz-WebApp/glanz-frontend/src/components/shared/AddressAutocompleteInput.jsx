import React, { useEffect, useState, useRef } from 'react';
import { addressesAPI } from '../../api/addresses';
import { MapPin, Check } from 'lucide-react';

function AddressAutocompleteInput({
  value,
  onChange,
  label,
  placeholder,
  required = false,
  helperText,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const suppressNextSearchRef = useRef(false);
  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      setSuggestions([]);
      setIsOpen(false);
      return undefined;
    }

    const trimmedValue = value.trim();
    if (trimmedValue.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        // Request more results to have better chance of finding exact matches
        const results = await addressesAPI.autocomplete(trimmedValue, 12);
        if (!cancelled) {
          setSuggestions(results || []);
          setIsOpen((results || []).length > 0);
          setSelectedIndex(-1);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value]);

  const handleSelectSuggestion = (suggestion) => {
    suppressNextSearchRef.current = true;
    onChange(suggestion.streetAddress || suggestion.displayName);
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="relative">
      {label ? (
        <label className="block font-semibold mb-2 text-[var(--text-color)]">
          {label}
          {required ? <span className="text-red-500 ml-1">*</span> : ''}
        </label>
      ) : null}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-color)]">
          <MapPin size={18} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => value.trim().length >= 2 && suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setSelectedIndex(-1);
            }, 120);
          }}
          placeholder={placeholder || 'Enter your address...'}
          required={required}
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-color)] placeholder:text-[var(--muted-color)] rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
      {helperText ? <p className="mt-2 text-xs text-[var(--muted-color)]">{helperText}</p> : null}
      {isOpen && suggestions.length > 0 ? (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 z-50 max-h-80 overflow-y-auto rounded-lg border-2 border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.displayName}-${index}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full text-left px-4 py-4 border-b border-[var(--border-color)] last:border-b-0 transition-colors duration-150 ${
                selectedIndex === index
                  ? 'bg-primary/15 text-primary'
                  : 'text-[var(--text-color)] hover:bg-[var(--surface-bg)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-1 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-base text-[var(--text-color)]">{suggestion.displayName}</p>
                  {suggestion.city || suggestion.state ? (
                    <p className="text-sm mt-1 font-medium text-[var(--muted-color)]">
                      {[suggestion.city, suggestion.state].filter(Boolean).join(', ')}
                    </p>
                  ) : null}
                </div>
                {selectedIndex === index && (
                  <Check size={20} className="flex-shrink-0 mt-1 text-primary" />
                )}
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {!loading && value.trim().length >= 2 && suggestions.length === 0 && isOpen ? (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] shadow-lg p-4 text-center text-sm text-[var(--muted-color)]">
          No addresses found. Please try a different search.
        </div>
      ) : null}
    </div>
  );
}

export default AddressAutocompleteInput;