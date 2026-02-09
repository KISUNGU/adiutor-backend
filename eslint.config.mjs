export default [
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'uploads/**',
      'test/**',
      'scripts/**',
      '*.config.js'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-console': 'off',
      'semi': ['warn', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'indent': ['warn', 2, { SwitchCase: 1 }],
      'comma-dangle': ['warn', 'never'],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'space-before-function-paren': ['warn', {
        anonymous: 'always',
        named: 'never',
        asyncArrow: 'always'
      }],
      'keyword-spacing': 'warn',
      'space-infix-ops': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn'
    }
  }
];
