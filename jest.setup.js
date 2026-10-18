// Los iconos cargan fuentes nativas; en pruebas basta un componente vacío.
jest.mock('@expo/vector-icons/Feather', () => {
  const { Text } = require('react-native');
  const Icon = () => require('react').createElement(Text, { accessibilityElementsHidden: true }, '');
  return { __esModule: true, default: Icon };
});
