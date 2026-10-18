import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme';
import { type as typeScale, type TypeVariant } from '../tokens';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  muted?: boolean;
  /** Cifras tabulares: los números no bailan al cambiar. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color, muted, tabular, align, style, ...rest }: Props) {
  const { colors } = useTheme();
  const isNumber = variant === 'score' || variant === 'scoreSmall' || variant === 'amount';
  return (
    <Text
      {...rest}
      style={[
        typeScale[variant],
        { color: color ?? (muted ? colors.inkMuted : colors.ink), textAlign: align },
        (tabular || isNumber) && { fontVariant: ['tabular-nums'] },
        variant === 'overline' && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
