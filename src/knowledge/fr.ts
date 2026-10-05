import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Images matricielles et images vectorielles',
    summary: "Pourquoi les photos deviennent floues quand on les agrandit, et pas les logos.",
    group: 'Les bases',
    body: `Il existe deux façons fondamentalement différentes d'enregistrer une image sur un ordinateur.

## Les images matricielles

Une image matricielle est une grille de minuscules carrés de couleur appelés pixels. Une photo prise avec un téléphone peut mesurer 4 000 pixels de large sur 3 000 de haut, soit douze millions de pixels, chacun avec sa propre couleur. JPEG, PNG, WebP, AVIF, HEIC et GIF sont tous des formats matriciels.

Les images matricielles sont idéales pour les photographies, où chaque pixel peut être légèrement différent. Leur limite, c'est que le nombre de pixels est fixe. Réduire une image matricielle supprime des pixels. L'agrandir oblige à inventer des pixels qui n'ont jamais existé : c'est pourquoi une petite image étirée pour remplir un écran paraît floue ou pixelisée. Aucun logiciel ne peut retrouver un détail qui n'a pas été capturé.

## Les images vectorielles

Une image vectorielle ne stocke pas de pixels. Elle stocke des instructions : tracer un cercle ici, une courbe de ce point à celui-là, remplir cette forme d'orange. SVG est le format vectoriel le plus courant sur le web. Comme les formes sont décrites mathématiquement, une image vectorielle peut être affichée à n'importe quelle taille et reste parfaitement nette.

Les vecteurs conviennent aux logos, aux icônes, aux schémas et au texte. Ils ne conviennent pas aux photographies, car une photo n'a pas de formes nettes à décrire.

## Comment Universal Images les traite

Universal Images travaille sur des images matricielles. Quand vous ajoutez un SVG, l'application le convertit une fois en pixels pour pouvoir le recadrer, le redimensionner et le convertir comme n'importe quelle autre image. Le résultat est une image matricielle : choisissez donc la taille dont vous avez besoin avant d'exporter. Si vous avez besoin d'un logo en plusieurs tailles, conservez le SVG d'origine et exportez chaque taille à partir de lui, plutôt que d'agrandir un petit export.

## Une règle utile

- Réduisez sans hésiter. Une image matricielle réduite rend généralement bien.
- Évitez d'agrandir une image matricielle au-delà de sa taille d'origine. L'application peut le faire, mais elle ne peut pas ajouter de vrais détails.
- Si vous disposez d'un original vectoriel, conservez-le. C'est la copie de référence.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF et HEIC : lequel utiliser ?',
    summary: "Les points forts de chaque format, et lequel choisir à l'enregistrement.",
    group: 'Les bases',
    body: `Les formats d'image sont différentes manières de ranger des pixels dans un fichier. Chacun fait des compromis différents entre taille du fichier, qualité, transparence et compatibilité.

## Les formats

- **JPEG** est le format classique pour les photos. Il utilise une compression avec perte, qui garde des fichiers légers en supprimant des détails que l'œil a peu de chances de remarquer. Il ne gère pas la transparence. Presque tout sait ouvrir un JPEG.
- **PNG** utilise une compression sans perte : chaque pixel est conservé à l'identique. Il gère la transparence. Il est idéal pour les captures d'écran, les graphismes aux contours nets et le texte, ainsi que les détourages. Une photo enregistrée en PNG est généralement bien plus lourde que la même photo en JPEG.
- **WebP** est un format plus récent conçu pour le web. Il peut être avec ou sans perte et gère la transparence. Pour les photos, il est en général plus léger qu'un JPEG de qualité comparable. Tous les principaux navigateurs actuels le prennent en charge, mais certains logiciels plus anciens non.
- **AVIF** est encore plus récent et produit souvent des fichiers plus légers que le WebP à qualité comparable. Sa prise en charge progresse mais reste moins universelle, et tous les navigateurs ne savent pas créer de fichiers AVIF.
- **HEIC** est le format qu'utilisent de nombreux iPhone pour les photos. Il est efficace, mais beaucoup de sites web et de programmes Windows ne savent pas l'ouvrir.
- **GIF** est un ancien format limité à 256 couleurs, surtout connu pour les courtes animations.

## Ce qu'Universal Images peut ouvrir et enregistrer

L'application ouvre les fichiers JPEG, PNG, WebP, AVIF, HEIC, GIF et SVG. Elle enregistre en JPEG, PNG, WebP ou AVIF. L'AVIF n'est proposé que si l'appareil que vous utilisez sait en créer.

Les photos HEIC sont converties en JPEG de haute qualité à l'ouverture, pour que le reste de l'application puisse les traiter. Un GIF animé devient une seule image fixe.

## Lequel choisir ?

- **Partager une photo avec n'importe qui, n'importe où :** JPEG.
- **Une photo pour votre propre site web :** WebP, ou AVIF si votre site le prend en charge.
- **Un logo, une capture d'écran ou tout ce qui contient du texte :** PNG.
- **Un détourage sur fond transparent :** PNG ou WebP. Le JPEG ne peut pas stocker de transparence.
- **Une photo d'iPhone que quelqu'un n'arrive pas à ouvrir :** convertissez-la en JPEG.

L'application affiche une estimation de la taille du fichier à mesure que vous changez de format et de qualité : cela vaut la peine d'essayer deux ou trois options et de les comparer.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Pixels, résolution et DPI',
    summary: "Ce que la taille d'une image signifie vraiment, à l'écran et sur papier.",
    group: 'Les bases',
    body: `Le mot résolution est employé pour désigner plusieurs choses différentes, ce qui crée beaucoup de confusion. Voici ce qui compte vraiment.

## Ce qui compte, ce sont les dimensions en pixels

L'information la plus importante sur une image numérique, ce sont ses dimensions en pixels : combien de pixels en largeur et combien en hauteur, par exemple 1920 sur 1080. Ce chiffre vous indique la quantité de détails que contient l'image. Universal Images affiche les dimensions en pixels et travaille avec elles.

## Le DPI n'est qu'une instruction d'impression

DPI, ou PPI, signifie points ou pixels par pouce. C'est une indication enregistrée dans certains fichiers image qui dit à une imprimante à quelle taille imprimer les pixels. Elle ne modifie pas les pixels eux-mêmes. Une image de 3 000 sur 2 000 pixels contient exactement les mêmes détails, que son fichier indique 72 DPI ou 300 DPI. La seule différence, c'est la taille qu'elle aura une fois imprimée.

À l'écran, le réglage DPI est ignoré. Un écran affiche simplement des pixels.

## Calculer la taille dont vous avez besoin

Pour l'impression, une recommandation courante est d'environ 300 pixels par pouce pour des photos regardées de près, et moins pour ce qui est vu de loin, comme les affiches. Pour calculer le nombre de pixels nécessaire, multipliez la taille d'impression en pouces par le nombre de pixels par pouce. Un pouce mesure 2,54 cm.

1. Une photo de 6 sur 4 pouces à 300 pixels par pouce nécessite 1800 sur 1200 pixels.
2. Une page A4 mesure environ 8,3 sur 11,7 pouces : à 300 pixels par pouce, il faut donc environ 2480 sur 3508 pixels.

Pour les écrans et le web, pensez à l'espace que l'image occupera. Une image affichée sur 800 pixels de large dans une page web a rarement besoin de dépasser environ le double, pour rester nette sur les écrans haute densité. Au-delà, elle ne fait que ralentir le chargement de la page.

## Le format d'image

Le format, ou rapport largeur/hauteur, décrit la forme de l'image : la largeur comparée à la hauteur, par exemple 16:9 ou 1:1. Si vous modifiez la largeur et la hauteur dans des proportions différentes, l'image est écrasée ou étirée. Universal Images garde les proportions verrouillées sauf si vous en décidez autrement, et ses préréglages pour les réseaux sociaux recadrent l'image à la forme de chaque plateforme plutôt que de la déformer.`,
  },
  {
    id: 'what-compression-does',
    title: 'Que fait réellement la compression ?',
    summary: "Compression avec ou sans perte, et ce que change le curseur de qualité.",
    group: 'Les bases',
    body: `Une photo non compressée est énorme. Douze millions de pixels, qui ont chacun besoin de plusieurs octets pour leur couleur, représentent des dizaines de mégaoctets. La compression est le moyen qu'ont les formats d'image de rendre cela gérable.

## La compression sans perte

La compression sans perte repère les motifs et les répétitions et les écrit de manière plus efficace, un peu comme écrire « 100 pixels bleus » au lieu de les énumérer un par un. À l'ouverture de l'image, chaque pixel revient exactement tel qu'il était. Le PNG est sans perte. Il fonctionne très bien sur les graphismes comportant de grandes zones de couleur unie, et beaucoup moins bien sur les photos, où des pixels voisins sont rarement identiques.

## La compression avec perte

La compression avec perte va plus loin en supprimant des informations que l'on a peu de chances de remarquer, comme de très fines variations de couleur ou de texture. Le JPEG, ainsi que le WebP et l'AVIF dans leur mode habituel, sont avec perte. On peut obtenir un fichier plusieurs fois plus léger que l'original, avec peu de différence visible. Les informations supprimées sont perdues définitivement.

## Le curseur de qualité

Quand vous enregistrez en JPEG, WebP ou AVIF, le curseur de qualité règle la quantité d'informations que l'encodeur est autorisé à supprimer. Une qualité plus élevée donne un fichier plus lourd qui conserve plus de détails. Une qualité plus basse donne un fichier plus léger et, à terme, des défauts visibles :

- des blocs carrés dans les zones unies, comme le ciel
- des détails fins brouillés, comme les cheveux ou l'herbe
- de légères ondulations autour des contours nets et du texte

La relation n'est pas régulière. Descendre depuis le haut de l'échelle permet souvent de gagner beaucoup de place sans changement visible, alors que descendre près du bas fait gagner peu et dégrade nettement l'image. Le PNG étant sans perte, il n'a pas de réglage de qualité.

## Conseils pratiques

- **Redimensionnez d'abord.** Ramener les dimensions en pixels à ce dont vous avez réellement besoin permet généralement de gagner bien plus que de baisser la qualité.
- **Surveillez l'estimation.** Universal Images met à jour la taille de fichier prévue à mesure que vous déplacez le curseur. Regardez l'aperçu, puis trouvez le réglage le plus bas qui vous convient.
- **Évitez d'enregistrer encore et encore.** Chaque enregistrement avec perte supprime un peu plus d'informations. Si vous devez faire d'autres modifications, repartez de l'original plutôt que de retravailler une copie déjà compressée.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'Comment fonctionne Universal Images',
    summary: "Où le travail est effectué, ce que font les outils d'IA, et leurs limites.",
    group: 'Fonctionnement',
    body: `Universal Images effectue tout son travail sur les images sur votre propre appareil. Il n'y a pas de serveur de traitement. Quand vous ajoutez une image, l'application lit le fichier, et toutes les étapes suivantes se déroulent dans l'application elle-même.

## Redimensionner et convertir

L'application dessine votre image sur un canevas interne à la taille choisie, puis l'enregistre dans le format et la qualité que vous avez sélectionnés. Quand elle réduit fortement une image, elle le fait en plusieurs étapes successives de division par deux plutôt qu'en une seule fois, ce qui évite les contours crénelés et scintillants qu'une forte réduction d'un coup peut produire.

Le recadrage fonctionne de la même façon : seule la partie située à l'intérieur du cadre est dessinée dans la nouvelle image. Les préréglages pour les réseaux sociaux recadrent et dimensionnent l'image selon la forme de chaque plateforme, et vous pouvez faire glisser l'image pour choisir ce qui reste dans le cadre.

L'export par lot applique les réglages de format et de taille choisis à toutes les images que vous avez ajoutées, et les télécharge ensemble dans un seul fichier ZIP.

## Supprimer l'arrière-plan

Supprimer l'arrière-plan utilise un modèle d'IA qui sépare le sujet de son arrière-plan. Le modèle s'exécute sur votre appareil. La première fois que vous l'utilisez, l'application peut avoir besoin de télécharger le modèle, qui est volumineux et que votre appareil conserve ensuite pour que les utilisations suivantes soient plus rapides. Ce téléchargement porte sur le modèle lui-même, identique pour tout le monde ; votre image n'est envoyée nulle part.

Il fonctionne le mieux avec un sujet bien net sur un arrière-plan distinct. Les cheveux fins, le verre et les scènes chargées peuvent le tromper : vérifiez donc les contours avant d'utiliser le résultat.

## Flouter les visages

Flouter les visages utilise un petit modèle de détection des visages, qui s'exécute lui aussi sur votre appareil, pour trouver les visages puis les flouter ou les pixeliser. Vous pouvez activer ou désactiver chaque visage individuellement et modifier l'intensité.

La détection automatique est une aide, pas une garantie. Elle peut manquer des visages petits, lointains, de profil ou partiellement cachés. Examinez toujours le résultat avant de le partager, et choisissez une intensité élevée : un léger flou ou de gros pixels peu marqués peuvent laisser un visage reconnaissable.

## Masquer avec des rectangles

Caviarder dessine des rectangles pleins sur l'image : faites glisser pour masquer quelque chose, ou touchez pour poser un rectangle, puis déplacez-le ou redimensionnez-le. Utile pour un nom, une plaque d'immatriculation, un écran ou un visage que la détection a manqué. Choisissez la couleur dans la section « Redact areas ».

Pendant la modification, les rectangles restent au-dessus et peuvent encore être déplacés ; votre original n'est pas modifié. L'image que vous téléchargez, sauvegardez en ligne ou placez dans un collage les contient peints dans ses pixels : rien de ce qu'ils couvrent ne peut être récupéré à partir de ce fichier. Un fichier de sauvegarde Universal Images est différent : il conserve l'original avec des rectangles encore déplaçables. Ne partagez donc que l'image téléchargée.

## Les collages

L'outil de collage dispose plusieurs photos côte à côte, empilées ou en grille, avec un espacement, des coins et un fond réglables. Vous pouvez télécharger le collage ou l'ajouter à vos images pour le redimensionner ou le convertir.

## Travailler hors ligne

Le redimensionnement, le recadrage, la conversion et la lecture des métadonnées fonctionnent sans aucune connexion. La suppression de l'arrière-plan et le floutage des visages n'ont besoin d'une connexion que pour le premier téléchargement de leurs modèles.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Métadonnées des photos et données de localisation',
    summary: "Ce qu'une photo peut révéler sur le lieu et le moment de la prise de vue, et comment le supprimer.",
    group: 'Confidentialité et sécurité',
    body: `La plupart des photos contiennent plus que l'image. Les appareils photo et les téléphones inscrivent dans le fichier des informations supplémentaires, appelées métadonnées. Le type le plus courant s'appelle EXIF. Il peut comprendre :

- la date et l'heure de la prise de vue
- la marque et le modèle de l'appareil photo ou du téléphone, parfois un numéro de série
- des réglages de prise de vue comme l'exposition et la focale
- le logiciel utilisé pour la retouche, et parfois un nom d'auteur ou de propriétaire
- **des coordonnées GPS** indiquant où la photo a été prise, souvent à quelques mètres près
- une petite vignette d'aperçu, qui peut encore montrer l'image d'origine après que l'image principale a été recadrée ou retouchée

Une grande partie de ces informations est conservée lorsqu'une photo est envoyée par e-mail ou comme fichier. Certains sites web et applications les suppriment lors de l'envoi, mais beaucoup ne le font pas, et il n'est pas toujours possible de savoir lesquels.

## Voir ce que contient une photo

Universal Images peut afficher les métadonnées d'une photo, en mettant en évidence les éléments qui renvoient à une personne, un lieu ou un appareil. Si la photo contient des coordonnées GPS, l'application dessine une petite carte montrant le pays et l'endroit du pays où la photo a été prise.

Cette carte est dessinée à partir des contours des pays fournis avec l'application : l'afficher n'apprend donc à personne où la photo a été prise. Si vous voulez plus de détails, un bouton permet de zoomer jusqu'au département ou à la région et à la ville la plus proche. Appuyer dessus charge un fichier de limites pour ce seul pays. Dans la version web de l'application, cela signifie le télécharger depuis le site web d'Universal Images. La requête indique le pays mais ne contient aucune coordonnée, et elle n'a lieu que lorsque vous appuyez sur le bouton. L'application ne recherche jamais d'adresse postale.

## Supprimer les métadonnées

Il existe deux moyens d'obtenir une copie nettoyée :

- **Supprimer les métadonnées**, dans le panneau des métadonnées, retire les métadonnées des fichiers JPEG, PNG et WebP sans recompresser l'image : la qualité reste intacte. Les informations de couleur nécessaires pour afficher correctement l'image sont conservées.
- **Tout export** depuis l'application est une image nouvellement créée. Redimensionner, convertir, recadrer ou simplement télécharger via l'application produit un fichier qui ne contient pas les données EXIF de l'original, y compris sa localisation.

Une exception à connaître : la sauvegarde Enregistrer sur l'ordinateur conserve volontairement votre image d'origine pour que vous puissiez continuer à la retoucher plus tard. Si l'original contenait des données de localisation, la sauvegarde aussi. Supprimez d'abord les métadonnées si c'est important pour vous.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'Ce qui quitte votre appareil',
    summary: "Exactement ce qui reste sur votre appareil, et les quelques éléments qui passent en ligne.",
    group: 'Confidentialité et sécurité',
    body: `Universal Images est conçu pour que vos images restent chez vous. Voici exactement ce qui se passe.

## Ce qui reste sur votre appareil

- **Vos images.** L'ouverture, le recadrage, le redimensionnement, la conversion, la suppression des métadonnées, la création de collages, la suppression de l'arrière-plan et le floutage des visages se font tous sur votre appareil. Vos images ne sont pas envoyées en ligne pour être traitées.
- **Téléchargements et sauvegardes.** Télécharger enregistre le résultat sur votre appareil. Enregistrer sur l'ordinateur crée un fichier de sauvegarde que vous conservez vous-même.

## Des téléchargements qui ne sont pas des envois

La première fois que vous utilisez la suppression de l'arrière-plan ou le floutage des visages, l'application peut télécharger le modèle d'IA dont elle a besoin depuis un réseau de diffusion de contenu. Le modèle est un fichier fixe, identique pour tout le monde. Ces serveurs voient une requête ordinaire provenant de votre connexion, comme pour n'importe quel téléchargement, mais ils ne reçoivent pas votre image. L'image est traitée par le modèle sur votre appareil.

Si vous zoomez sur la carte de localisation jusqu'au niveau du département ou de la région, la version web de l'application télécharge le fichier de limites d'un pays depuis le site web d'Universal Images. Cette requête indique le pays, pas les coordonnées de la photo.

## Uniquement si vous le choisissez : le stockage en ligne

Si vous vous connectez avec votre Universal ID et choisissez de stocker une image chez UNI·SIM, l'application envoie l'image finale, la même que celle que vous donnerait le bouton Télécharger, pour que vous puissiez la récupérer sur un autre appareil. Le stockage d'images en ligne est gratuit avec un Universal ID. Les comptes gratuits disposent d'une limite généreuse ; si vous l'atteignez un jour, supprimez une image dont vous n'avez plus besoin. Supprimer une image la retire du stockage.

Il s'agit d'un stockage cloud ordinaire, pas d'un chiffrement de bout en bout. Il est chiffré pendant le transfert et au repos, et l'accès est limité à votre compte, mais c'est nous qui détenons les clés. Si cela compte pour une image en particulier, ne la stockez pas ; l'application fonctionne entièrement sans compte.

## Ce que chaque application Universal envoie

Pendant que l'application est ouverte, elle envoie à notre serveur un petit signal indiquant qu'elle est utilisée, afin que le menu puisse afficher combien de personnes l'utilisent. Ce signal contient le nom de l'application, le type d'appareil (web, téléphone ou ordinateur), un identifiant aléatoire créé sur cet appareil et, si vous êtes connecté, votre compte. Si vous êtes connecté, l'application enregistre aussi que vous l'avez ouverte, pour la page d'activité de votre compte. Ni l'un ni l'autre ne contient quoi que ce soit sur vos images : ni leur nom, ni leur taille, ni leur contenu.

L'application ne contient aucun outil d'analyse, de suivi ou de publicité tiers.`,
  },
]

export default articles
