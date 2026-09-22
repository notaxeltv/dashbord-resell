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
6. [Deploy su Vercel](#deploy-su-vercel)
7. [Invitare gli utenti del team](#invitare-gli-utenti-del-team)
8. [Note e limitazioni](#note-e-limitazioni)

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
│   ├── login/
│   │   └── page.tsx                   # Pagina di login (email + password)
│   └── dashboard/
│       ├── layout.tsx                 # Protezione rotte + header condiviso
│       ├── page.tsx                   # KPI + elenco carte
│       ├── cards/
│       │   ├── new/page.tsx           # Form "Nuova carta"
│       │   └── [id]/edit/page.tsx     # Form di modifica carta
│       ├── purchases/page.tsx         # Elenco + form acquisti (dialog)
│       └── sales/page.tsx             # Elenco + form vendite (dialog)
├── components/
│   ├── ui/                            # Componenti shadcn/ui (button, input, ...)
│   ├── dashboard/header.tsx           # Header con email utente + logout
│   ├── cards/delete-card-button.tsx
│   ├── purchases/
│   │   ├── new-purchase-dialog.tsx
│   │   └── delete-purchase-button.tsx
│   └── sales/
│       ├── new-sale-dialog.tsx
│       └── delete-sale-button.tsx
├── lib/
│   ├── supabase.ts                    # Client Supabase per il browser
│   ├── supabase/server.ts             # Client Supabase per Server Components
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

- KPI: totale carte, in stock, in vendita, vendute.
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
- Eliminazione riga con conferma (non ripristina automaticamente lo stato
  della carta collegata: se necessario, modificala manualmente da
  `/dashboard`).

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
