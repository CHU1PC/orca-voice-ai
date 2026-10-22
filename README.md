# Orca Voice AI

iPhone版Orcaで、表示中のClaude CodeまたはCodexの会話を読み上げるMVPです。Mac上のOrcaとペアリングし、普段のOrcaのタブをそのまま使います。音声合成にはiOS標準の`AVSpeechSynthesizer`を使い、音声用の有料APIは呼び出しません。

## できること

- 選択中のタブの右端にある音声ボタンで、タブごとに読み上げをオン・オフできます。初期状態はオフです。
- オンの間、完了した進捗メッセージを届いた順に読み上げます。
- 長い最終回答は冒頭と末尾を抜粋し、約240字に短縮して読み上げます。内容を理解して再要約するAIモデルは使っていません。
- コードブロック、コマンド、ファイルパス、URLは内容の読み上げを避け、存在を短く伝えます。
- Orcaが前面から外れたときや、会話画面を離れたときは再生を止めます。

現時点ではiOSのClaude CodeとCodexのターミナルタブを対象にしています。会話の識別情報を取得できないタブには、音声ボタンが表示されません。

## 使い方

1. このMVPを含むiPhoneアプリの開発ビルドを用意し、Macで動作中のOrcaとペアリングします。App Storeで配布されているOrcaアプリには、このリポジトリの変更はまだ含まれません。
2. iPhoneのOrcaでClaude CodeまたはCodexのタブを開きます。
3. 選択中のタブの右端にある音声ボタンを押します。設定はそのタブに保存され、別のタブは自動でオンになりません。

Mac側のOrcaを起動したままにし、iPhoneで会話画面を表示して使います。音声入力、双方向の音声会話、バックグラウンド再生、Androidには対応していません。

## 開発と検証

このリポジトリは、[Orca本体](https://github.com/stablyai/orca)からモバイル関連のソースを抜き出したMVP用スナップショットです。デスクトップ全体や一部の開発用依存は含まないため、単独で完全なOrcaをビルドするリポジトリではありません。iPhoneアプリの開発ビルドには、[元のソースと基点コミット](SOURCE.md)を参照してください。

依存を用意した環境では、音声機能のテストを次のコマンドで実行できます。

```bash
cd mobile
pnpm exec vitest run \
  src/session/orca-voice-text.test.ts \
  src/session/use-orca-tab-transcript-fallback.test.ts \
  src/session/use-orca-tab-voice.test.tsx
```

MVP開発時には、このテスト6件の通過とiPhoneシミュレーターでのClaude CodeおよびCodexのボタン表示を確認しました。Claude Codeのボタンはオン・オフを確認しましたが、実際の回答が音声で再生されるところまでは検証していません。

開発状況は[Issue #1](https://github.com/CHU1PC/orca-voice-ai/issues/1)と[PR #2](https://github.com/CHU1PC/orca-voice-ai/pull/2)で追えます。元のOrcaソースはMITライセンスです。詳細は[LICENSE](LICENSE)を参照してください。
