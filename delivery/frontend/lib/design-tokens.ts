/**
 * Design Tokens for Casa PRO v1.2
 * Based on provided mockups and design requirements
 */

export const designTokens = {
    // Colors — Casa PRO green + gold palette
    colors: {
        // Primary brand colors
        primary: {
            main: '#2E7D5E',     // Main green
            light: '#3A9D73',    // Lighter green
            dark: '#1A5A42',     // Darker green
        },
        // Accent colors
        accent: {
            gold: '#FFD700',     // Gold — highlights, active states
            green: '#2E7D5E',    // Brand green
            blue: 'hsl(217, 91%, 60%)',
            orange: 'hsl(24, 100%, 50%)',
            red: 'hsl(0, 84%, 60%)',
        },
        // Status colors
        status: {
            new: '#2E7D5E',
            inProgress: '#FFD700',
            completed: '#3A9D73',
            cancelled: 'hsl(0, 84%, 60%)',
        },
        // Neutral colors
        neutral: {
            50: 'hsl(150, 8%, 95%)',
            100: 'hsl(150, 8%, 91%)',
            200: 'hsl(150, 8%, 81%)',
            300: 'hsl(150, 8%, 69%)',
            400: 'hsl(150, 8%, 57%)',
            500: 'hsl(150, 8%, 45%)',
            600: 'hsl(150, 8%, 33%)',
            700: 'hsl(150, 8%, 21%)',
            800: 'hsl(150, 10%, 13%)',
            900: 'hsl(150, 12%, 9%)',
        },
    },

    // Typography
    typography: {
        fontFamily: {
            sans: 'var(--font-geist-sans)',
            mono: 'var(--font-geist-mono)',
        },
        fontSize: {
            xs: '0.75rem',    // 12px
            sm: '0.875rem',   // 14px
            base: '1rem',     // 16px
            lg: '1.125rem',   // 18px
            xl: '1.25rem',    // 20px
            '2xl': '1.5rem',  // 24px
            '3xl': '1.875rem', // 30px
            '4xl': '2.25rem',  // 36px
        },
        fontWeight: {
            normal: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
        },
    },

    // Spacing (8px grid)
    spacing: {
        0: '0',
        1: '0.25rem',   // 4px
        2: '0.5rem',    // 8px
        3: '0.75rem',   // 12px
        4: '1rem',      // 16px
        5: '1.25rem',   // 20px
        6: '1.5rem',    // 24px
        8: '2rem',      // 32px
        10: '2.5rem',   // 40px
        12: '3rem',     // 48px
        16: '4rem',     // 64px
        20: '5rem',     // 80px
    },

    // Border radius
    borderRadius: {
        none: '0',
        sm: '0.375rem',   // 6px
        md: '0.5rem',     // 8px
        lg: '0.75rem',    // 12px
        xl: '1rem',       // 16px
        full: '9999px',
    },

    // Shadows
    shadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },

    // Animation durations
    animation: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
    },
} as const;

// Status badge colors helper
export const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
        NEW: designTokens.colors.status.new,
        IN_PROGRESS: designTokens.colors.status.inProgress,
        COMPLETED: designTokens.colors.status.completed,
        CANCELLED: designTokens.colors.status.cancelled,
        PENDING: designTokens.colors.status.inProgress,
        CONFIRMED: designTokens.colors.status.completed,
        EXPIRED: designTokens.colors.status.cancelled,
        DEAL_CLOSED: designTokens.colors.status.completed,
        REJECTED: designTokens.colors.status.cancelled,
    };
    return statusMap[status] || designTokens.colors.neutral[500];
};

// Client type colors
export const getClientTypeColor = (type: string) => {
    const typeMap: Record<string, string> = {
        BUYER: '#3A9D73',      // Green — buyers
        SELLER: '#D4A843',     // Gold — sellers
        NEW_BUILDING: '#2E7D5E', // Brand green — new buildings
    };
    return typeMap[type] || designTokens.colors.neutral[500];
};
