import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
        extends: [tseslint.configs.recommended],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'scripts/'],
    },
);
