# Dither Paradise

Dithering para imagens, vídeos e GIFs num canvas infinito, com edição independente por objeto e exportação em lote.

## Baixar

Vá em **[Releases](../../releases/latest)** e baixe o arquivo do seu sistema:

- **Mac** (Apple Silicon e Intel): `Dither.Paradise_<versão>_universal.dmg`. Abra o .dmg e arraste o app para Aplicativos.
  Na primeira vez o macOS avisa que o app não foi verificado: clique com o botão direito no app → **Abrir** → **Abrir**.
  Se aparecer "está danificado", rode no Terminal: `xattr -cr "/Applications/Dither Paradise.app"`.
- **Windows**: `Dither.Paradise_<versão>_x64-setup.exe`. Se o SmartScreen avisar, clique em **Mais informações → Executar assim mesmo**.

Os avisos aparecem porque o app ainda não tem assinatura digital paga (Apple/Microsoft); não é vírus.

## Rodar em desenvolvimento

```bash
npm install
npm run dev            # só a interface, no navegador (http://localhost:5173)
npx tauri dev          # o app de desktop com recarregamento ao vivo
```

## Gerar o app

### macOS (nesta máquina)

```bash
npx tauri build --bundles app,dmg
```

Sai em `src-tauri/target/release/bundle/` (`macos/Dither Paradise.app` e `dmg/Dither Paradise_<versão>_aarch64.dmg`).

O app não é assinado. No Mac onde foi compilado ele abre normalmente; em outro Mac, o macOS bloqueia na primeira vez: clique com o botão direito no app → **Abrir**, ou vá em Ajustes do Sistema → Privacidade e Segurança → **Abrir mesmo assim**. Para distribuir sem esse aviso é preciso uma conta Apple Developer (assinatura + notarização).

### Windows (e macOS universal) pelo GitHub Actions

O workflow `.github/workflows/build.yml` compila em máquinas reais de Windows e macOS:

1. Suba este projeto para um repositório no GitHub.
2. Aba **Actions** → **Build desktop apps** → **Run workflow** (ou crie uma tag `v0.1.0` e faça push).
3. Ao terminar, baixe os instaladores em **Artifacts** da execução, ou no Release em rascunho:
   - Windows: `Dither Paradise_<versão>_x64-setup.exe` (NSIS) e `.msi`
   - macOS: `.dmg` universal (Apple Silicon + Intel)

No Windows o instalador também não é assinado, então o SmartScreen mostra um aviso: **Mais informações → Executar assim mesmo**.

## Ícone

O ícone é gerado por código:

```bash
node scripts/make-icon.mjs                                                    # public/icon.svg e src-tauri/app-icon.svg
swift scripts/svg-to-png.swift src-tauri/app-icon.svg src-tauri/app-icon.png 1024
npx tauri icon src-tauri/app-icon.png                                         # todos os tamanhos (.icns, .ico, png)
```
