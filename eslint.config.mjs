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
    },
    {
        ignores: ['dist/', 'node_modules/', 'scripts/'],
    },
);
