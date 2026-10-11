// Envoie un email d'essai avec la configuration du serveur (SMTP Infomaniak ou Resend). Sur le serveur, en evly :
//   cd /srv/evly/app/server && sudo systemd-run --uid=evly --pipe --wait -p EnvironmentFile=/etc/evly/app.env \
//     -p WorkingDirectory=$PWD npx ts-node --transpile-only scripts/testEmail.ts info@evly.ch
import { resend, FROM_EMAIL, MAIL_PROVIDER } from '../src/lib/mailer';

(async () => {
  const to = process.argv[2];
  if (!to) { console.error('Adresse manquante'); process.exit(1); }
  const r = await resend.emails.send({
    from: FROM_EMAIL, to, subject: 'EvLY : email de test depuis la Suisse',
    html: '<p>Bonjour,</p><p>Cet email de test a été envoyé par le serveur EvLY hébergé chez Infomaniak.</p>',
  });
  console.log(`Fournisseur : ${MAIL_PROVIDER}`, r.error ? `ÉCHEC : ${r.error.message}` : `envoyé (${r.data?.id})`);
  process.exit(r.error ? 1 : 0);
})();
