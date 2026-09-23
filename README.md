# Pokémon Card Manager

Dashboard multiutente per gestire un'attività di compravendita di carte
Pokémon: inventario, acquisti, vendite e margini. Costruita con **Next.js 15
(App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui** e
**Supabase** (Auth + Postgres + RLS). Pensata per essere usata da 2 o più
persone (es. tu e un socio) con dati condivisi.

## Indice

1. [Stack tecnico](#stack-tecnico)
2. [Struttura del progetto](#struttura-del-progetto)
3. [Funzionalità](#funzionalità)
4. [Setup Supabase](#setup-supabase)
5. [Setup locale](#setup-locale)
6. [Notifiche Telegram e WhatsApp](#notifiche-telegram-e-whatsapp)
7. [Deploy su Vercel](#deploy-su-vercel)
8. [Invitare gli utenti del team](#invitare-gli-utenti-del-team)
9. [Note e limitazioni](#note-e-limitazioni)

## Stack tecnico

- **Next.js 15** (App Router, React 19)
- **TypeScript**
- **Tailwind CSS v3** + **shadcn/ui** (componenti Radix: Button, Input,
  Label, Select, Card, Table, Dialog, Checkbox, Textarea, Badge)
- **@supabase/supabase-js** + **@supabase/ssr** per l'integrazione con
  Supabase (Auth + Postgres) sia lato client che lato server (Server
  Components / Middleware)
- **Deploy target**: Vercel

## Struttura del progetto

```
.
├── app/
│   ├── layout.tsx                     # Root layout (font, metadata)
│   ├── page.tsx                       # Redirect a /dashboard o /login
│   ├── globals.css                    # Stili globali Tailwind
│   ├── api/
│   │   └── notify/route.ts            # Route Handler: invio notifiche Telegram/WhatsApp
│   ├── login/
│   │   └── page.tsx                   # Pagina di login (email + password)
│   └── dashboard/
│       ├── layout.tsx                 # Protezione rotte + header condiviso
│       ├── page.tsx                   # KPI + elenco carte
│       ├── cards/
│       │   ├── new/page.tsx           # Form "Nuova carta"
│       │   └── [id]/edit/page.tsx     # Form di modifica carta
│       ├── purchases/page.tsx         # Elenco + form acquisti (dialog)
│       ├── sales/page.tsx             # Elenco + form vendite (dialog)
│       ├── report/page.tsx            # Resoconto con filtri periodo (settimana/mese/anno/custom)
│       └── accounting/page.tsx        # Contabilità: bilancio automatico + stima tasse
├── components/
│   ├── ui/                            # Componenti shadcn/ui (button, input, ...)
│   ├── dashboard/
│   │   ├── header.tsx                 # Header con email utente + logout
│   │   └── kpi-card.tsx               # Card KPI con accento colorato e icona
│   ├── cards/delete-card-button.tsx
│   ├── purchases/
│   │   ├── new-purchase-dialog.tsx
│   │   └── delete-purchase-button.tsx
│   ├── sales/
│   │   ├── new-sale-dialog.tsx
│   │   └── delete-sale-button.tsx
│   ├── reports/
│   │   ├── period-filter.tsx          # Filtro periodo (settimana/mese/anno/custom)
│   │   └── spending-chart.tsx         # Grafico a barre acquisti vs vendite
│   └── accounting/
│       ├── year-filter.tsx            # Selettore anno fiscale
│       ├── new-transaction-dialog.tsx # Form movimento extra (entrata/spesa)
│       ├── delete-transaction-button.tsx
│       └── tax-estimator.tsx          # Simulatore stima imposte (forfettario/ordinario)
├── lib/
│   ├── supabase.ts                    # Client Supabase per il browser
│   ├── supabase/server.ts             # Client Supabase per Server Components
│   ├── notify.ts                      # Helper client + formattazione messaggi notifiche
│   ├── types.ts                       # Tipi TypeScript delle tabelle
│   ├── constants.ts                   # Liste/opzioni condivise (select, badge)
│   └── utils.ts                       # Utility `cn()` per shadcn/ui
├── supabase/
│   └── schema.sql                     # Script SQL completo da eseguire su Supabase
├── middleware.ts                      # Refresh automatico sessione Supabase
├── components.json                    # Config shadcn/ui
├── tailwind.config.ts
├── .env.example
└── README.md
```

## Funzionalità

### Autenticazione

- Login con email/password tramite Supabase Auth (`app/login/page.tsx`).
- Tutte le rotte sotto `/dashboard/*` sono protette: il controllo sessione è
  centralizzato in `app/dashboard/layout.tsx` (se non c'è sessione, redirect a
  `/login`). Questo copre automaticamente anche `app/dashboard/page.tsx` e
  tutte le sotto-rotte, evitando di duplicare il controllo in ogni pagina.
- L'email dell'utente loggato è mostrata nell'header della dashboard, con
  bottone "Esci".
- Non esiste una pagina di registrazione pubblica: i nuovi membri del team
  vengono invitati tramite Supabase Auth (vedi [sezione dedicata](#invitare-gli-utenti-del-team)),
  scelta adatta a un tool interno per un piccolo team.

### Gestione carte (`/dashboard`, `/dashboard/cards/*`)

- KPI: totale carte, in stock, in vendita, riservate, vendute, più una
  seconda riga con investimento in portafoglio, valore stimato attuale e
  margine potenziale (calcolati sulle carte non vendute).
- Card "Distribuzione per stato" (barre di progresso) e "Carte di maggior
  valore" (top 5 per valore stimato), per una panoramica visiva immediata.
- Tabella con nome, set, condizione, prezzo acquisto, prezzo target, stato,
  data di inserimento.
- **+ Nuova carta** → form completo (`/dashboard/cards/new`) con tutti i
  campi richiesti (nome, set, codice set, numero, lingua, condizione, foil,
  edizione giapponese, prezzo/data/fonte acquisto, prezzo target, stato,
  note). L'inserimento imposta `owner_id` sull'utente loggato.
- **Modifica** → `/dashboard/cards/[id]/edit`, stesso form precompilato.
- **Elimina** → bottone con conferma, direttamente dalla tabella.

### Acquisti (`/dashboard/purchases`)

- Elenco storico con data, fonte, totale, spedizione, note, chi ha inserito
  l'acquisto.
- KPI: numero acquisti, totale spesa (incluse spedizioni).
- **+ Nuovo acquisto** apre una modale (shadcn `Dialog`) con il form di
  inserimento; `created_by` viene impostato sull'utente loggato.
- **Modifica** apre la stessa modale precompilata con i dati esistenti, per
  correggere un inserimento errato (data, fonte, importi, note).
- Eliminazione riga con conferma.

### Vendite (`/dashboard/sales`)

- Elenco storico con data, carta venduta, marketplace, prezzo, fee, importo
  netto (calcolato automaticamente dal database), venditore.
- KPI: numero vendite, incasso netto totale.
- **+ Nuova vendita** apre una modale con selezione della carta (solo carte
  non ancora vendute), marketplace, prezzo, spedizione rimborsata dal
  compratore, fee, data, info acquirente, note. `sold_by` viene impostato
  sull'utente loggato; alla creazione la carta collegata viene aggiornata a
  stato `sold`.
- **Modifica** apre la stessa modale precompilata per correggere marketplace,
  prezzo, spedizione, fee, data, acquirente o note. La carta collegata non è
  modificabile da qui (per cambiarla, elimina la vendita e creane una nuova),
  così da evitare incongruenze sullo stato delle carte.
- Eliminazione riga con conferma (non ripristina automaticamente lo stato
  della carta collegata: se necessario, modificala manualmente da
  `/dashboard`).

### Resoconto (`/dashboard/report`)

- Filtri periodo: **Settimana**, **Mese**, **Anno** o **Personalizzato**
  (con selettori data "Dal"/"Al"), gestiti via query string (`?period=...`)
  così l'URL resta condivisibile/bookmarkabile.
- KPI di periodo: totale acquistato, totale venduto (netto), margine netto,
  numero di transazioni.
- Grafico a barre (CSS puro, nessuna dipendenza esterna) che confronta
  acquisti e vendite nel tempo, con granularità automatica in base alla
  durata del periodo (giorno se ≤31 giorni, mese se più lungo, anno per
  periodi pluriennali).
- Tabella di dettaglio con tutti i movimenti (acquisti e vendite) ordinati
  per data.

### Contabilità (`/dashboard/accounting`)

- Selettore **anno fiscale** (basato sugli anni presenti nei dati, più
  l'anno corrente).
- **Bilancio automatico**: KPI di ricavi totali, costi totali, utile netto
  e numero di movimenti extra per l'anno selezionato, più un conto
  economico mensile (ricavi, costi, utile per ciascun mese dell'anno).
- **Movimenti extra**: tabella + form (`+ Movimento extra`) per registrare
  entrate o spese non legate a una singola carta (es. abbonamenti
  piattaforme, materiali di imballaggio, commissioni), usando la tabella
  `transactions` già prevista nello schema. Vengono incluse automaticamente
  nel bilancio. Ogni riga ha anche **Modifica** (stesso form precompilato)
  ed **Elimina**, per correggere eventuali errori di inserimento.
- **Stima delle tasse**: simulatore interattivo con due regimi selezionabili:
  - **Forfettario**: reddito imponibile = ricavi totali × coefficiente di
    redditività (default 40%, modificabile), imposta sostitutiva (5% o
    15%, modificabile) e stima opzionale dei contributi INPS (aliquota
    modificabile, default 24%).
  - **Ordinario (semplificato)**: reddito imponibile = utile netto
    dell'anno, IRPEF calcolata a scaglioni (23% fino a €28.000, 35% da
    €28.001 a €50.000, 43% oltre €50.000) più una stima indicativa (2%) di
    addizionali regionali/comunali.
  - ⚠️ **È una stima indicativa a scopo di pianificazione**, calcolata solo
    sui dati presenti nell'app: non sostituisce la consulenza di un
    commercialista e non considera deduzioni, detrazioni, altre entrate o
    la normativa fiscale in vigore nell'anno di riferimento.

### Notifiche automatiche (Telegram / WhatsApp)

L'app può inviare automaticamente un messaggio su un gruppo/chat Telegram
e/o su WhatsApp (tramite Twilio) in questi casi:

- **Nuova carta aggiunta** — nome, set, stato, prezzo di acquisto.
- **Cambio di stato di una carta** (es. `in_stock` → `listed`,
  `listed` → `sold`, ecc.), rilevato quando si salva una modifica.
- **Nuovo acquisto registrato** — fonte, totale, spedizione.
- **Nuova vendita registrata** — carta, marketplace, prezzo, netto.

Entrambi i canali sono **opzionali e indipendenti**: se le relative
variabili d'ambiente non sono configurate, l'app funziona normalmente senza
inviare nulla. Vedi [Notifiche Telegram e WhatsApp](#notifiche-telegram-e-whatsapp)
per la configurazione.

## Setup Supabase

1. Crea un account su [supabase.com](https://supabase.com) e un nuovo
   progetto (scegli una password sicura per il database e la region più
   vicina a te).
2. Una volta pronto il progetto, vai su **SQL Editor** nel menu laterale.
3. Crea una nuova query, copia **tutto** il contenuto del file
   [`supabase/schema.sql`](./supabase/schema.sql) di questo repository e
   incollalo nell'editor.
4. Esegui lo script (**Run**). Verranno creati:
   - le tabelle `profiles`, `cards`, `purchases`, `sales`, `transactions`;
   - il trigger `cards_set_updated_at` che aggiorna automaticamente
     `updated_at` su `cards` ad ogni modifica;
   - il trigger `on_auth_user_created` che crea automaticamente una riga in
     `profiles` ogni volta che viene creato un nuovo utente in
     `auth.users` (es. dopo un invito via email);
   - Row Level Security abilitata su tutte le tabelle, con policy che
     permettono SELECT/INSERT/UPDATE/DELETE a qualsiasi utente autenticato
     (adatto a un piccolo team con fiducia reciproca; nessun ruolo
     complesso).
5. Vai su **Project Settings > API** e copia:
   - **Project URL** → sarà il valore di `NEXT_PUBLIC_SUPABASE_URL`;
   - **anon public key** → sarà il valore di `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. (Opzionale ma consigliato) In **Authentication > Providers**, verifica che
   il provider **Email** sia attivo e, per un tool interno, disabilita
   "Allow new users to sign up" se vuoi impedire registrazioni pubbliche
   dirette (gli utenti verranno comunque creati tramite invito, vedi sotto).

## Setup locale

### 1. Installa le dipendenze

```bash
npm install
```

### 2. Configura le variabili d'ambiente

Copia il file di esempio e inserisci i valori del tuo progetto Supabase:

```bash
cp .env.example .env.local
```

`.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
```

### 3. Avvia il server di sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000): verrai reindirizzato a
`/login`.

### 4. Crea il primo utente

La UI non ha una pagina di registrazione pubblica. Per creare il primo
utente (es. te stesso):

1. Vai su Supabase Dashboard → **Authentication > Users** → **Add user**
   (oppure **Invite**).
2. Crea l'utente con la tua email e imposta direttamente una password
   (con "Add user" puoi specificarla subito; con "Invite" l'utente la
   imposterà tramite email — vedi sezione successiva).
3. Grazie al trigger `on_auth_user_created`, verrà creata automaticamente
   anche la riga corrispondente in `public.profiles`.
4. Torna su `http://localhost:3000/login` e accedi con email e password.

## Notifiche Telegram e WhatsApp

Le notifiche sono gestite da una Route Handler server-side
(`app/api/notify/route.ts`) chiamata dal client dopo ogni operazione
rilevante (`lib/notify.ts`). I token/segreti restano sempre lato server: non
vengono mai esposti al browser. Puoi attivare uno o entrambi i canali.

### Telegram

1. Apri Telegram e cerca **@BotFather**.
2. Invia `/newbot`, scegli un nome e uno username per il bot. BotFather ti
   restituirà un **token** nel formato `123456789:AAExxxxxxxxxxxxxxxxxxxxx`
   → sarà il valore di `TELEGRAM_BOT_TOKEN`.
3. Cerca il tuo nuovo bot su Telegram e invia un qualsiasi messaggio (es.
   "ciao") per avviare la conversazione. Se vuoi ricevere le notifiche su un
   **gruppo**, crea il gruppo, aggiungi il bot come membro e invia un
   messaggio nel gruppo.
4. Recupera il tuo `chat_id` visitando nel browser:

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

   Nel JSON di risposta cerca il campo `"chat":{"id": ...}` (per una chat
   privata) o l'id negativo del gruppo (per un gruppo). Quel numero è il
   valore di `TELEGRAM_CHAT_ID`.
5. Imposta le due variabili in `.env.local` (locale) e tra le Environment
   Variables di Vercel (produzione):

   ```bash
   TELEGRAM_BOT_TOKEN="123456789:AAExxxxxxxxxxxxxxxxxxxxx"
   TELEGRAM_CHAT_ID="123456789"
   ```

### WhatsApp (via Twilio)

L'API ufficiale WhatsApp Business di Meta richiede verifica aziendale e
template di messaggio pre-approvati per scrivere per primi a un utente:
troppo complessa per un tool interno di 2 persone. **Twilio** offre
un'alternativa più semplice con una sandbox WhatsApp gratuita per lo
sviluppo:

1. Crea un account su [twilio.com](https://www.twilio.com) (il piano
   trial è sufficiente per iniziare).
2. Nella Console Twilio vai su **Messaging > Try it out > Send a WhatsApp
   message** per attivare la Sandbox.
3. Segui le istruzioni a schermo: invia dal tuo WhatsApp personale il codice
   indicato (es. `join <parola-codice>`) al numero sandbox Twilio
   (`+1 415 523 8886`) per collegare il tuo numero alla sandbox.
4. Copia da Console Twilio (Account Dashboard):
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
5. Imposta le variabili in `.env.local`/Vercel:

   ```bash
   TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   TWILIO_WHATSAPP_FROM="whatsapp:+14155238886"   # numero sandbox Twilio
   TWILIO_WHATSAPP_TO="whatsapp:+391234567890"    # il tuo numero, con prefisso internazionale
   ```

**Limitazioni della sandbox**: è pensata per lo sviluppo/test, va
"riattivata" reinviando il codice ogni ~3 giorni e può inviare messaggi solo
ai numeri che si sono uniti alla sandbox. Per un uso in produzione stabile
con WhatsApp servirebbe richiedere un numero WhatsApp Business verificato su
Twilio (a pagamento, richiede approvazione).

### Verifica rapida

Con il server avviato (`npm run dev`) puoi testare la Route Handler
direttamente, senza passare dalla UI:

```bash
curl -X POST http://localhost:3000/api/notify \
  -H "Content-Type: application/json" \
  -d '{"message":"Test notifica 🃏"}'
```

La risposta indica per ciascun canale se il messaggio è stato inviato
(`sent`), saltato perché non configurato (`skipped`) o se c'è stato un
errore (es. token non valido).

## Deploy su Vercel

1. Crea un repository GitHub con questo progetto e fai push del codice:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TUO_USERNAME/TUO_REPO.git
   git push -u origin main
   ```

2. Vai su [vercel.com](https://vercel.com), accedi con GitHub e clicca
   **Add New... > Project**.
3. Seleziona il repository appena creato e importalo.
4. Nella schermata di configurazione del progetto, apri **Environment
   Variables** e aggiungi:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL del progetto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key del progetto Supabase
   - (opzionale) `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
     `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
     `TWILIO_WHATSAPP_TO` se vuoi abilitare le notifiche (vedi
     [sezione dedicata](#notifiche-telegram-e-whatsapp))
5. Clicca **Deploy**. Al termine avrai un URL pubblico (es.
   `https://tuo-progetto.vercel.app`).
6. In Supabase, vai su **Authentication > URL Configuration** e aggiungi
   l'URL di Vercel sia come **Site URL** che tra le **Redirect URLs**, così
   i link di invito/reset password funzionano correttamente in produzione.

Ogni nuovo push sul branch principale genererà automaticamente un nuovo
deploy su Vercel.

## Invitare gli utenti del team

Per aggiungere il tuo socio (o altri collaboratori) senza costruire una
pagina di registrazione pubblica:

1. Vai su Supabase Dashboard → **Authentication > Users**.
2. Clicca **Invite user**, inserisci l'email del collaboratore e conferma.
   Supabase invierà un'email con un link di invito.
3. Il collaboratore clicca il link, che lo porta a impostare la propria
   password sulla pagina gestita da Supabase (o sul Site URL configurato, se
   personalizzato).
4. Una volta impostata la password, il collaboratore può accedere
   normalmente da `/login` con la propria email e password.
5. Grazie al trigger `on_auth_user_created`, il profilo condiviso
   (`public.profiles`) viene creato automaticamente: da questo momento tutti
   i membri vedono le stesse carte, acquisti e vendite (RLS permette
   l'accesso a qualsiasi utente autenticato).

In alternativa, per il setup più rapido possibile con un team di 2 persone,
puoi anche creare l'utente direttamente da **Authentication > Users > Add
user** impostando tu stesso una password temporanea da comunicare in modo
sicuro al collaboratore.

## Note e limitazioni

- Le policy RLS sono intenzionalmente semplici: qualsiasi utente autenticato
  può leggere/scrivere su tutte le tabelle. Non ci sono ruoli con permessi
  differenziati (es. "admin" vs "member") né logiche di ownership stretta:
  è una scelta adatta a un piccolo team che condivide lo stesso inventario.
- Non è implementata alcuna integrazione di pagamento (niente Stripe) né
  funzionalità avanzate non richieste dalle specifiche.
- L'eliminazione di una vendita non ripristina automaticamente lo stato
  della carta collegata (rimane `sold`): se necessario, aggiornalo
  manualmente modificando la carta.
- I campi numerici (prezzi) sono gestiti come `numeric(10,2)` per evitare
  problemi di arrotondamento tipici dei float.
- Le notifiche Telegram/WhatsApp vengono inviate dal client subito dopo
  un'operazione riuscita (insert/update): sono "best-effort" e non
  garantite al 100% (es. se il dispositivo perde la connessione proprio in
  quel momento). Per una garanzia di consegna più forte si potrebbe in
  futuro spostare il trigger su un **Database Webhook di Supabase** che
  chiama `/api/notify` direttamente dal database ad ogni insert/update,
  indipendentemente dal client.
