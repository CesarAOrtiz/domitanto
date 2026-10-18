import { StyleSheet, View } from 'react-native';

import { AppText } from '../../ui/components/AppText';
import { DominoMark } from '../../ui/components/DominoMark';
import { ThemeProvider } from '../../ui/theme';
import { light } from '../../ui/tokens';
import { logicalSize, type CardFormat, type CardModel, type CardTemplate } from './cardModel';

interface Look {
  bg: string;
  ink: string;
  muted: string;
  stroke: string;
  surface: string;
  surfaceInk: string;
  appearance: 'light' | 'dark';
}

function look(template: CardTemplate, winnerColor: string): Look {
  switch (template) {
    case 'pizarra':
      return {
        bg: '#13261F',
        ink: '#F3F1EC',
        muted: '#B9C7BF',
        stroke: '#F3F1EC',
        surface: '#1C352B',
        surfaceInk: '#F3F1EC',
        appearance: 'dark',
      };
    case 'carnaval':
      return {
        bg: winnerColor,
        ink: '#FFFFFF',
        muted: '#FFFFFF',
        stroke: '#17212B',
        surface: '#FFFFFF',
        surfaceInk: '#17212B',
        appearance: 'light',
      };
    default:
      return {
        bg: light.bg,
        ink: light.ink,
        muted: light.inkMuted,
        stroke: light.stroke,
        surface: light.surface,
        surfaceInk: light.ink,
        appearance: 'light',
      };
  }
}

interface Props {
  model: CardModel;
  format: CardFormat;
  template: CardTemplate;
}

/**
 * Tarjeta de resultado para compartir. Se dibuja a 360 de ancho y se captura a 1080:
 * sus colores son fijos (no siguen el tema del teléfono) para que la imagen sea igual
 * para todos.
 */
export function ResultCard({ model, format, template }: Props) {
  const size = logicalSize(format);
  const winner = model.sides.find((s) => s.winner);
  const winnerColor = light.team[winner?.position ?? 0]!;
  const l = look(template, winnerColor);
  const story = format === 'story';

  return (
    <ThemeProvider appearance={l.appearance}>
      <View
        collapsable={false}
        style={[styles.card, size, { backgroundColor: l.bg, paddingVertical: story ? 48 : 28 }]}
      >
        <View style={styles.brand}>
          <DominoMark top={6} bottom={6} size={9} horizontal fill={l.surface} />
          <AppText variant="label" color={l.ink} style={styles.brandText}>
            LA MESA
          </AppText>
          <AppText variant="caption" color={l.muted} style={styles.flexEnd}>
            {model.date}
          </AppText>
        </View>

        <View style={[styles.hero, story && styles.heroStory]}>
          <AppText variant="overline" color={l.muted}>
            {winner ? 'Ganador' : 'Resultado'}
          </AppText>
          <AppText variant="title" color={l.ink} numberOfLines={2} style={story ? styles.winnerStory : styles.winner}>
            {model.winnerName ?? 'Sin ganador'}
          </AppText>
          {winner?.members ? (
            <AppText variant="bodyStrong" color={l.ink} numberOfLines={1}>
              {winner.members}
            </AppText>
          ) : null}
        </View>

        <View style={styles.sides}>
          {model.sides.map((s) => (
            <View
              key={s.position}
              style={[
                styles.side,
                {
                  backgroundColor: s.winner && template === 'clasica' ? light.team[s.position] : l.surface,
                  borderColor: l.stroke,
                },
              ]}
            >
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: s.winner && template === 'clasica' ? '#FFFFFF' : light.team[s.position],
                  },
                ]}
              >
                <AppText
                  variant="label"
                  color={s.winner && template === 'clasica' ? light.team[s.position] : '#FFFFFF'}
                >
                  {s.letter}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText
                  variant="bodyStrong"
                  numberOfLines={1}
                  color={s.winner && template === 'clasica' ? '#FFFFFF' : l.surfaceInk}
                >
                  {s.name}
                </AppText>
                {s.members ? (
                  <AppText
                    variant="caption"
                    numberOfLines={1}
                    color={
                      s.winner && template === 'clasica'
                        ? '#FFFFFF'
                        : template === 'carnaval'
                          ? light.inkMuted
                          : l.muted
                    }
                  >
                    {s.members}
                  </AppText>
                ) : null}
              </View>
              <AppText
                variant="heading"
                tabular
                style={styles.total}
                color={s.winner && template === 'clasica' ? '#FFFFFF' : l.surfaceInk}
              >
                {s.total}
              </AppText>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          {model.sessionLine ? (
            <AppText variant="caption" color={l.ink} numberOfLines={2}>
              {model.sessionLine}
            </AppText>
          ) : null}
          <AppText variant="caption" color={l.muted}>
            Meta {model.target} · {model.hands} {model.hands === 1 ? 'mano' : 'manos'}
          </AppText>
          <AppText variant="caption" color={l.muted}>
            Apuntado con La Mesa · Apunte de dominó
          </AppText>
        </View>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 24, justifyContent: 'space-between', overflow: 'hidden' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { letterSpacing: 2 },
  flexEnd: { flex: 1, textAlign: 'right' },
  hero: { gap: 2 },
  heroStory: { gap: 6 },
  winner: { fontSize: 34, lineHeight: 38 },
  winnerStory: { fontSize: 42, lineHeight: 46 },
  sides: { gap: 10 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 18, padding: 14 },
  badge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  total: { fontSize: 30, lineHeight: 34 },
  footer: { gap: 2 },
});
