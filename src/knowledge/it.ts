import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Immagini raster e vettoriali',
    summary: 'Perché le foto diventano sfocate quando le ingrandisci, e i loghi no.',
    group: 'Le basi',
    body: `Esistono due modi fondamentalmente diversi per memorizzare un'immagine su un computer.

## Immagini raster

Un'immagine raster è una griglia di minuscoli quadratini colorati chiamati pixel. Una foto scattata con il telefono può essere larga 4.000 pixel e alta 3.000, cioè dodici milioni di pixel, ognuno con il proprio colore. JPEG, PNG, WebP, AVIF, HEIC e GIF sono tutti formati raster.

Le immagini raster sono ideali per le fotografie, in cui ogni pixel può essere leggermente diverso. Il loro limite è che il numero di pixel è fisso. Rimpicciolire un'immagine raster significa scartare dei pixel. Ingrandirla significa inventare pixel che non c'erano, ed è per questo che un'immagine piccola allargata a tutto schermo appare morbida o a blocchi. Nessun software può recuperare dettagli che non sono stati catturati.

## Immagini vettoriali

Un'immagine vettoriale non memorizza pixel. Memorizza istruzioni: disegna un cerchio qui, una curva da questo punto a quello, riempi questa forma di arancione. SVG è il formato vettoriale più diffuso sul web. Poiché le forme sono descritte in modo matematico, un'immagine vettoriale può essere disegnata a qualsiasi dimensione e resta perfettamente nitida.

I vettori sono adatti a loghi, icone, diagrammi e testo. Non sono adatti alle fotografie, perché una foto non ha forme nette da descrivere.

## Come le gestisce Universal Images

Universal Images lavora sulle immagini raster. Quando aggiungi un SVG, l'app lo disegna una volta in pixel, così puoi ritagliarlo, ridimensionarlo e convertirlo come qualsiasi altra immagine. Il risultato è un'immagine raster, quindi scegli la dimensione che ti serve prima di esportare. Se ti serve un logo in più dimensioni, conserva l'SVG originale ed esporta ogni dimensione a partire da quello, invece di ingrandire un'esportazione piccola.

## Una regola utile

- Rimpicciolisci liberamente. Ridurre un'immagine raster di solito dà buoni risultati.
- Evita di ingrandire le immagini raster oltre la loro dimensione originale. L'app può farlo, ma non può aggiungere dettagli reali.
- Se hai un originale vettoriale, conservalo. È la copia master.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF e HEIC: quale usare?',
    summary: 'In cosa eccelle ogni formato, e quale scegliere quando salvi.',
    group: 'Le basi',
    body: `I formati di immagine sono modi diversi di racchiudere i pixel in un file. Ognuno trova un equilibrio diverso tra dimensione del file, qualità, trasparenza e diffusione del supporto.

## I formati

- **JPEG** è il formato classico per le foto. Usa una compressione con perdita, che mantiene i file piccoli scartando dettagli che difficilmente l'occhio nota. Non supporta la trasparenza. Quasi tutto è in grado di aprire un JPEG.
- **PNG** usa una compressione senza perdita, quindi ogni pixel viene conservato esattamente. Supporta la trasparenza. È ideale per screenshot, grafiche con bordi netti e testo, e scontornati. Le foto salvate in PNG sono di solito molto più pesanti della stessa foto in JPEG.
- **WebP** è un formato più recente pensato per il web. Può essere con o senza perdita e supporta la trasparenza. Per le foto è in genere più leggero di un JPEG di qualità simile. Tutti i principali browser attuali lo supportano, anche se alcuni software più vecchi no.
- **AVIF** è ancora più recente e spesso produce file più piccoli di WebP a qualità simile. Il supporto è in crescita ma meno universale, e non tutti i browser sono in grado di creare file AVIF.
- **HEIC** è il formato che molti iPhone usano per le foto. È efficiente, ma molti siti web e programmi per Windows non riescono ad aprirlo.
- **GIF** è un formato datato limitato a 256 colori, noto soprattutto per le brevi animazioni.

## Cosa può aprire e salvare Universal Images

L'app apre JPEG, PNG, WebP, AVIF, HEIC, GIF e SVG. Salva in JPEG, PNG, WebP o AVIF. AVIF viene proposto solo quando il dispositivo che stai usando è in grado di crearlo.

Le foto HEIC vengono convertite in un JPEG di alta qualità al momento dell'apertura, così il resto dell'app può lavorarci. Una GIF animata diventa una singola immagine statica.

## Quale scegliere?

- **Condividere una foto con chiunque, ovunque:** JPEG.
- **Una foto per il tuo sito web:** WebP, oppure AVIF se il tuo sito lo supporta.
- **Un logo, uno screenshot o qualsiasi cosa contenga testo:** PNG.
- **Uno scontornato con sfondo trasparente:** PNG o WebP. JPEG non può memorizzare la trasparenza.
- **Una foto da iPhone che qualcuno non riesce ad aprire:** convertila in JPEG.

L'app mostra una stima della dimensione del file mentre cambi formato e qualità, quindi vale la pena provare due o tre opzioni e confrontarle.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Pixel, risoluzione e DPI',
    summary: "Cosa significa davvero la dimensione di un'immagine sullo schermo e sulla carta.",
    group: 'Le basi',
    body: `La parola risoluzione viene usata per indicare cose diverse, e questo crea molta confusione. Ecco cosa conta davvero.

## Contano le dimensioni in pixel

Il dato più importante di un'immagine digitale sono le sue dimensioni in pixel: quanti pixel è larga e quanti è alta, per esempio 1920 per 1080. Questo numero ti dice quanti dettagli contiene l'immagine. Universal Images mostra e usa le dimensioni in pixel.

## I DPI sono solo un'indicazione per la stampa

DPI, o PPI, significa punti o pixel per pollice. È un'annotazione memorizzata in alcuni file di immagine che indica alla stampante quanto grandi stampare i pixel. Non modifica i pixel. Un'immagine di 3.000 per 2.000 pixel contiene esattamente gli stessi dettagli sia che il file indichi 72 DPI sia 300 DPI. L'unica differenza è quanto grande risulta sulla carta.

Sullo schermo, l'impostazione DPI viene ignorata. Uno schermo mostra semplicemente pixel.

## Calcolare la dimensione che ti serve

Per la stampa, un'indicazione comune è di circa 300 pixel per pollice per le foto guardate da vicino, e meno per ciò che si guarda da lontano, come i manifesti. Per calcolare i pixel che ti servono, moltiplica la dimensione di stampa in pollici per i pixel per pollice. Un pollice corrisponde a 2,54 cm.

1. Una foto da 6 per 4 pollici a 300 pixel per pollice richiede 1800 per 1200 pixel.
2. Una pagina A4 misura circa 8,3 per 11,7 pollici, quindi a 300 pixel per pollice richiede circa 2480 per 3508 pixel.

Per gli schermi e il web, pensa allo spazio che l'immagine occuperà. Un'immagine mostrata larga 800 pixel in una pagina web raramente deve essere più grande di circa il doppio per restare nitida sugli schermi ad alta densità. Qualsiasi cosa più grande rende solo la pagina più lenta da caricare.

## Proporzioni

Le proporzioni sono la forma dell'immagine: il rapporto tra larghezza e altezza, come 16:9 o 1:1. Se modifichi larghezza e altezza in misura diversa, l'immagine risulta schiacciata o allungata. Universal Images mantiene le proporzioni bloccate a meno che tu non scelga diversamente, e i suoi preset per i social media ritagliano l'immagine secondo la forma di ciascuna piattaforma invece di deformarla.`,
  },
  {
    id: 'what-compression-does',
    title: 'Cosa fa davvero la compressione?',
    summary: 'Compressione con e senza perdita, e cosa cambia il cursore della qualità.',
    group: 'Le basi',
    body: `Una foto non compressa è enorme. Dodici milioni di pixel, ognuno dei quali richiede diversi byte per il proprio colore, arrivano a decine di megabyte. La compressione è il modo in cui i formati di immagine rendono gestibile tutto questo.

## Compressione senza perdita

La compressione senza perdita individua schemi e ripetizioni e li scrive in modo più efficiente, un po' come scrivere "100 pixel blu" invece di elencarli uno per uno. Quando l'immagine viene aperta, ogni pixel torna esattamente com'era. PNG è senza perdita. Funziona molto bene sulle grafiche con ampie aree di colore uniforme e molto meno sulle foto, dove i pixel vicini sono raramente identici.

## Compressione con perdita

La compressione con perdita va oltre, scartando informazioni che difficilmente si notano, come variazioni molto sottili di colore o di trama. JPEG, e WebP e AVIF nelle loro modalità abituali, sono con perdita. Il risultato può essere un file molte volte più piccolo dell'originale con differenze visibili minime. Le informazioni scartate sono perse per sempre.

## Il cursore della qualità

Quando salvi in JPEG, WebP o AVIF, il cursore della qualità controlla quanto l'encoder può scartare. Una qualità più alta significa un file più grande con più dettagli conservati. Una qualità più bassa significa un file più piccolo e, a un certo punto, problemi visibili:

- quadrati a blocchi nelle zone uniformi, come il cielo
- dettagli fini impastati, come capelli o erba
- leggere increspature intorno ai bordi netti e al testo

Il rapporto non è lineare. Scendere dalla parte più alta della scala spesso fa risparmiare molto spazio senza alcuna differenza visibile, mentre scendere vicino al fondo fa risparmiare poco e peggiora molto l'aspetto. PNG è senza perdita, quindi non ha un'impostazione di qualità.

## Consigli pratici

- **Prima ridimensiona.** Ridurre le dimensioni in pixel a quelle che ti servono davvero di solito fa risparmiare molto più che abbassare la qualità.
- **Tieni d'occhio la stima.** Universal Images aggiorna la dimensione prevista del file mentre sposti il cursore. Guarda l'anteprima, poi trova l'impostazione più bassa che ti soddisfa.
- **Evita di salvare più e più volte.** Ogni salvataggio con perdita scarta un po' di più. Se devi fare altre modifiche, torna all'originale invece di rimodificare una copia già compressa.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'Come funziona Universal Images',
    summary: 'Dove avviene il lavoro, cosa fanno gli strumenti di IA e quali sono i loro limiti.',
    group: 'Come funziona',
    body: `Universal Images svolge tutto il lavoro sulle immagini sul tuo dispositivo. Non c'è alcun server di elaborazione. Quando aggiungi un'immagine, l'app legge il file e ogni passaggio successivo avviene nell'app stessa.

## Ridimensionare e convertire

L'app disegna la tua immagine su una tela interna alla dimensione che scegli, poi la salva nel formato e nella qualità che selezioni. Quando rimpicciolisce molto un'immagine, lo fa in diversi passaggi dimezzando ogni volta invece che tutto in una volta, evitando i bordi seghettati e tremolanti che una singola grande riduzione può produrre.

Il ritaglio funziona allo stesso modo: solo la parte dentro il ritaglio viene disegnata nella nuova immagine. I preset per i social media ritagliano e ridimensionano l'immagine secondo la forma di ciascuna piattaforma, e puoi trascinare per scegliere cosa resta nell'inquadratura.

L'esportazione in blocco applica il formato e le dimensioni scelte a tutte le immagini che hai aggiunto e le scarica insieme in un unico file ZIP.

## Rimozione dello sfondo

Rimuovi sfondo usa un modello di IA che separa il soggetto dallo sfondo. Il modello funziona sul tuo dispositivo. La prima volta che lo usi, l'app potrebbe dover scaricare il modello, che è di grandi dimensioni e viene poi conservato dal tuo dispositivo, così gli utilizzi successivi sono più rapidi. Quello che viene scaricato è il modello stesso, identico per tutti; la tua immagine non viene inviata da nessuna parte.

Funziona meglio con un soggetto chiaro su uno sfondo ben distinto. Capelli sottili, vetro e scene affollate possono confonderlo, quindi controlla i bordi prima di usare il risultato.

## Sfocare i volti

Sfoca volti usa un piccolo modello di rilevamento dei volti, anch'esso in funzione sul tuo dispositivo, per trovare i volti e poi sfocarli o pixelarli. Puoi attivare o disattivare i singoli volti e regolarne l'intensità.

Il rilevamento automatico è un aiuto, non una garanzia. Può non trovare volti piccoli, lontani, girati o parzialmente nascosti. Controlla sempre il risultato prima di condividerlo e usa un'impostazione forte: una sfocatura leggera o pixel grandi e morbidi possono lasciare un volto riconoscibile.

## Collage

Lo strumento collage dispone più foto affiancate, impilate o in una griglia, con spaziatura, angoli e sfondo regolabili. Puoi scaricare il collage o aggiungerlo di nuovo alle tue immagini per ridimensionarlo o convertirlo.

## Lavorare offline

Ridimensionamento, ritaglio, conversione e lettura dei metadati funzionano senza alcuna connessione. La rimozione dello sfondo e la sfocatura dei volti richiedono una connessione solo per il primo download dei rispettivi modelli.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Metadati delle foto e dati sulla posizione',
    summary: 'Cosa può rivelare una foto su dove e quando è stata scattata, e come rimuoverlo.',
    group: 'Privacy e sicurezza',
    body: `La maggior parte delle foto contiene più della sola immagine. Fotocamere e telefoni scrivono nel file informazioni aggiuntive, chiamate metadati. Il tipo più comune è noto come EXIF. Può includere:

- la data e l'ora dello scatto
- la marca e il modello della fotocamera o del telefono, a volte un numero di serie
- impostazioni della fotocamera come esposizione e lunghezza focale
- il software usato per modificarla, e a volte il nome di un autore o proprietario
- **coordinate GPS** che indicano dove è stata scattata la foto, spesso con una precisione di pochi metri
- una piccola miniatura di anteprima, che può mostrare ancora l'immagine originale anche dopo che l'immagine principale è stata ritagliata o modificata

Gran parte di queste informazioni resta quando una foto viene inviata per email o come file. Alcuni siti web e app le rimuovono al caricamento, ma molti no, e non sempre puoi sapere quali.

## Vedere cosa contiene una foto

Universal Images può mostrarti i metadati di una foto, evidenziando le parti che rimandano a una persona, a un luogo o a un dispositivo. Se la foto ha coordinate GPS, l'app disegna una piccola mappa che mostra il Paese e il punto in cui è stata scattata.

La mappa è disegnata a partire dai contorni dei Paesi inclusi nell'app, quindi mostrarla non rivela a nessuno dove è stata scattata la foto. Se vuoi più dettagli, c'è un pulsante per ingrandire fino alla contea e alla città più vicina. Premendolo si carica un file dei confini per quel solo Paese. Nella versione web dell'app, questo significa scaricarlo dal sito di Universal Images. La richiesta indica il Paese ma non contiene coordinate, e avviene solo quando premi il pulsante. L'app non cerca mai un indirizzo stradale.

## Rimuovere i metadati

Ci sono due modi per ottenere una copia pulita:

- **Rimuovi metadati** nel pannello dei metadati elimina i metadati dai file JPEG, PNG e WebP senza ricomprimere l'immagine, quindi la qualità resta intatta. Le informazioni sul colore necessarie per visualizzare correttamente l'immagine vengono conservate.
- **Qualsiasi esportazione** dall'app è un'immagine creata da zero. Ridimensionando, convertendo, ritagliando o semplicemente scaricando tramite l'app ottieni un file che non contiene i dati EXIF dell'originale, compresa la posizione.

Un'eccezione da conoscere: il backup Salva sul computer conserva di proposito la tua immagine originale, così puoi continuare a modificarla in seguito. Se l'originale conteneva dati sulla posizione, li contiene anche il backup. Se per te è importante, rimuovi prima i metadati.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'Cosa lascia il tuo dispositivo',
    summary: 'Esattamente cosa resta sul tuo dispositivo, e le poche cose che vanno online.',
    group: 'Privacy e sicurezza',
    body: `Universal Images è pensato perché le tue immagini restino con te. Ecco esattamente cosa succede.

## Resta sul tuo dispositivo

- **Le tue immagini.** Apertura, ritaglio, ridimensionamento, conversione, rimozione dei metadati, creazione di collage, rimozione dello sfondo e sfocatura dei volti avvengono tutti sul tuo dispositivo. Le tue immagini non vengono caricate online per essere elaborate.
- **Download e backup.** Scarica salva il risultato sul tuo dispositivo. Salva sul computer crea un file di backup che conservi tu.

## Download che non sono caricamenti

La prima volta che usi la rimozione dello sfondo o la sfocatura dei volti, l'app potrebbe scaricare il modello di IA necessario da una rete di distribuzione dei contenuti. Il modello è un file fisso, identico per tutti. Quei server vedono una normale richiesta dalla tua connessione, come per qualsiasi download, ma non ricevono la tua immagine. L'immagine viene elaborata dal modello sul tuo dispositivo.

Se ingrandisci la mappa della posizione fino al livello di contea, la versione web dell'app scarica il file dei confini di un Paese dal sito di Universal Images. La richiesta indica il Paese, non le coordinate della foto.

## Solo se lo scegli tu: archiviazione online

Se accedi con il tuo Universal ID e scegli di archiviare un'immagine con UNI·SIM, l'app carica l'immagine finita, la stessa che ti darebbe il pulsante Scarica, così puoi recuperarla su un altro dispositivo. Ogni immagine archiviata usa un token, ed eliminandola il token ti viene restituito e l'immagine viene rimossa dall'archivio.

Si tratta di un normale archivio cloud, non di crittografia end-to-end. È cifrato in transito e a riposo e l'accesso è limitato al tuo account, ma le chiavi le abbiamo noi. Se per una certa immagine questo è importante, non archiviarla; l'app funziona pienamente anche senza account.

## Cosa invia ogni app Universal

Mentre l'app è aperta, invia al nostro server un piccolo segnale per indicare che è in uso, così il menu può mostrare quante persone la usano. Il segnale contiene il nome dell'app, il tipo di dispositivo (web, telefono o computer), un ID casuale creato su questo dispositivo e, se hai effettuato l'accesso, il tuo account. Se hai effettuato l'accesso, l'app registra anche che l'hai aperta, per la pagina delle attività del tuo account. Nessuno dei due include qualcosa sulle tue immagini: né i nomi, né le dimensioni, né il contenuto.

Nell'app non ci sono strumenti di analisi, tracciamento o pubblicità di terze parti.`,
  },
]

export default articles
