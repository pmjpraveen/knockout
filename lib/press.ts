/** Touch-down feedback: a slight shrink and dim the instant a finger lands (Pressable's `pressed`), released on lift. */
export const pressFeedback = (isPressed: boolean) => (isPressed ? { transform: [{ scale: 0.97 }], opacity: 0.85 } : null);
