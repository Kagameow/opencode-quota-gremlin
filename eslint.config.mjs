import antfu from '@antfu/eslint-config'

export default antfu({
  solid: true,
}, {
  rules: {
    'antfu/top-level-function': 'off',
    'style/brace-style': ['error', '1tbs'],
  },
})
