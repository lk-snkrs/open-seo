export function renderLoginPage(message?: string): string {
  const notice = message ? `<p class="notice" role="alert">${message}</p>` : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenSEO — LK Sneakers</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #080808; color: #f7f7f7; }
    main { width: min(92vw, 420px); padding: 36px; border: 1px solid #2b2b2b; border-radius: 18px; background: #111; box-shadow: 0 24px 80px #0008; }
    .eyebrow { margin: 0 0 8px; color: #a3ff12; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 30px; letter-spacing: -.04em; }
    .subtitle { margin: 10px 0 28px; color: #aaa; line-height: 1.5; }
    label { display: block; margin: 16px 0 7px; color: #ddd; font-size: 14px; font-weight: 650; }
    input { width: 100%; padding: 13px 14px; border: 1px solid #383838; border-radius: 10px; background: #0a0a0a; color: #fff; font: inherit; }
    input:focus { outline: 2px solid #a3ff12; outline-offset: 2px; }
    button { width: 100%; margin-top: 24px; padding: 13px; border: 0; border-radius: 10px; background: #a3ff12; color: #0a0a0a; font: inherit; font-weight: 850; cursor: pointer; }
    .notice { padding: 11px 13px; border: 1px solid #6e3030; border-radius: 9px; background: #2b1515; color: #ffc7c7; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">LK Sneakers</p>
    <h1>OpenSEO</h1>
    <p class="subtitle">Entre com sua conta autorizada do LK-HUB.</p>
    ${notice}
    <form method="post" action="/login">
      <label for="email">E-mail</label>
      <input id="email" name="email" type="email" autocomplete="username" required maxlength="254">
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024">
      <button type="submit">Entrar</button>
    </form>
  </main>
</body>
</html>`;
}
