import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  theme: {
    colors: {
      val: {
        'black': '#0F1923',
        'dark': '#111827',
        'darker': '#0A0E13',
        'red': '#FF4655',
        'red-dark': '#E63946',
        'red-glow': '#FD4556',
        'cream': '#ECE8E1',
        'gray': '#768079',
        'gray-dark': '#3D4752',
      },
    },
  },
  shortcuts: {
    'btn-val': 'relative bg-val-red text-white font-bold py-3 px-6 hover:bg-val-red-dark transition-all duration-200',
    'card-val': 'bg-val-dark border border-val-gray-dark rounded-lg',
    'glow-border': 'shadow-[0_0_10px_rgba(255,70,85,0.3)]',
    'bg-val-gradient': 'bg-gradient-to-b from-val-black to-val-darker',
  },
  presets: [
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetWind4(),
    presetWebFonts({
      fonts: {
        sans: 'Rubik:400,500,600,700',
        mono: 'JetBrains Mono',
        logo: 'Luckiest Guy',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: [
    'bg-val-red',
    'bg-val-black',
    'text-val-cream',
    'bg-val-gradient',
  ],
})
