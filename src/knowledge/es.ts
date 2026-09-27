import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Imágenes rasterizadas y vectoriales',
    summary: 'Por qué las fotos se ven borrosas al ampliarlas y los logotipos no.',
    group: 'Conceptos básicos',
    body: `Hay dos formas fundamentalmente distintas de guardar una imagen en un ordenador.

## Imágenes rasterizadas

Una imagen rasterizada es una cuadrícula de diminutos cuadrados de color llamados píxeles. Una foto hecha con un teléfono puede medir 4.000 píxeles de ancho y 3.000 de alto, es decir, doce millones de píxeles, cada uno con su propio color. JPEG, PNG, WebP, AVIF, HEIC y GIF son todos formatos rasterizados.

Las imágenes rasterizadas son ideales para fotografías, en las que cada píxel puede ser ligeramente distinto. Su limitación es que el número de píxeles es fijo. Al reducir una imagen rasterizada se descartan píxeles. Al ampliarla hay que inventar píxeles que nunca existieron, y por eso una imagen pequeña estirada para llenar una pantalla se ve difuminada o pixelada. Ningún programa puede recuperar un detalle que no se captó.

## Imágenes vectoriales

Una imagen vectorial no guarda píxeles. Guarda instrucciones: dibuja un círculo aquí, una curva de este punto a aquel, rellena esta forma de naranja. SVG es el formato vectorial más habitual en la web. Como las formas se describen matemáticamente, una imagen vectorial se puede dibujar a cualquier tamaño y se mantiene perfectamente nítida.

Los vectores son adecuados para logotipos, iconos, diagramas y texto. No lo son para fotografías, porque una foto no tiene formas limpias que describir.

## Cómo las trata Universal Images

Universal Images trabaja con imágenes rasterizadas. Cuando añade un SVG, la aplicación lo dibuja una vez en píxeles para poder recortarlo, redimensionarlo y convertirlo como cualquier otra imagen. El resultado es una imagen rasterizada, así que elija el tamaño que necesita antes de exportar. Si necesita un logotipo en varios tamaños, conserve el SVG original y exporte cada tamaño a partir de él, en lugar de ampliar una exportación pequeña.

## Una regla útil

- Reduzca el tamaño sin reparos. Reducir una imagen rasterizada suele dar buen resultado.
- Evite ampliar las imágenes rasterizadas por encima de su tamaño original. La aplicación puede hacerlo, pero no puede añadir detalle real.
- Si tiene un original vectorial, consérvelo. Es la copia maestra.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF y HEIC: ¿cuál usar?',
    summary: 'Para qué sirve cada formato y cuál elegir al guardar.',
    group: 'Conceptos básicos',
    body: `Los formatos de imagen son distintas maneras de empaquetar píxeles en un archivo. Cada uno busca un equilibrio diferente entre el tamaño del archivo, la calidad, la transparencia y lo extendida que está su compatibilidad.

## Los formatos

- **JPEG** es el formato clásico para fotos. Usa compresión con pérdida, que mantiene los archivos pequeños descartando detalles que el ojo difícilmente notará. No admite transparencia. Casi cualquier programa puede abrir un JPEG.
- **PNG** usa compresión sin pérdida, así que cada píxel se conserva exactamente. Admite transparencia. Es ideal para capturas de pantalla, gráficos con bordes nítidos y texto, y recortes. Las fotos guardadas en PNG suelen ocupar mucho más que la misma foto en JPEG.
- **WebP** es un formato más reciente diseñado para la web. Puede ser con pérdida o sin pérdida y admite transparencia. Para fotos, suele ocupar menos que un JPEG de calidad similar. Todos los navegadores principales actuales lo admiten, aunque algunos programas más antiguos no.
- **AVIF** es todavía más reciente y a menudo produce archivos más pequeños que WebP con una calidad similar. Su compatibilidad crece, pero es menos universal, y no todos los navegadores pueden crear archivos AVIF.
- **HEIC** es el formato que usan muchos iPhone para las fotos. Es eficiente, pero muchos sitios web y programas de Windows no pueden abrirlo.
- **GIF** es un formato antiguo limitado a 256 colores, conocido sobre todo por las animaciones cortas.

## Qué puede abrir y guardar Universal Images

La aplicación abre JPEG, PNG, WebP, AVIF, HEIC, GIF y SVG. Guarda en JPEG, PNG, WebP o AVIF. AVIF solo se ofrece cuando el dispositivo que está usando puede crearlo.

Las fotos HEIC se convierten en un JPEG de alta calidad al abrirlas, para que el resto de la aplicación pueda trabajar con ellas. Un GIF animado se convierte en una sola imagen fija.

## ¿Cuál conviene elegir?

- **Compartir una foto con cualquiera, en cualquier lugar:** JPEG.
- **Una foto para su propio sitio web:** WebP, o AVIF si su sitio lo admite.
- **Un logotipo, una captura de pantalla o cualquier cosa con texto:** PNG.
- **Un recorte con fondo transparente:** PNG o WebP. JPEG no puede guardar transparencia.
- **Una foto de iPhone que alguien no puede abrir:** conviértala a JPEG.

La aplicación muestra una estimación del tamaño del archivo mientras cambia el formato y la calidad, así que merece la pena probar dos o tres opciones y compararlas.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Píxeles, resolución y DPI',
    summary: 'Qué significa realmente el tamaño de una imagen en pantalla y en papel.',
    group: 'Conceptos básicos',
    body: `La palabra resolución se usa para referirse a varias cosas distintas, lo que genera mucha confusión. Esto es lo que de verdad importa.

## Lo que cuenta son las dimensiones en píxeles

El dato más importante de una imagen digital son sus dimensiones en píxeles: cuántos píxeles tiene de ancho y cuántos de alto, por ejemplo 1920 por 1080. Esa cifra indica cuánto detalle contiene la imagen. Universal Images muestra y trabaja con dimensiones en píxeles.

## Los DPI son solo una instrucción para imprimir

DPI, o PPI, significa puntos o píxeles por pulgada. Es una nota guardada en algunos archivos de imagen que indica a la impresora a qué tamaño imprimir los píxeles. No cambia los píxeles en sí. Una imagen de 3.000 por 2.000 píxeles contiene exactamente el mismo detalle tanto si su archivo dice 72 DPI como 300 DPI. La única diferencia es el tamaño con el que sale en papel.

En una pantalla, el ajuste de DPI se ignora. Una pantalla simplemente muestra píxeles.

## Cómo calcular el tamaño que necesita

Para imprimir, una pauta habitual es de unos 300 píxeles por pulgada para fotos que se ven de cerca, y menos para cosas que se ven a distancia, como los carteles. Para calcular los píxeles que necesita, multiplique el tamaño de impresión en pulgadas por los píxeles por pulgada. Una pulgada equivale a 2,54 cm.

1. Una foto de 6 por 4 pulgadas a 300 píxeles por pulgada necesita 1800 por 1200 píxeles.
2. Una página A4 mide unas 8,3 por 11,7 pulgadas, así que a 300 píxeles por pulgada necesita aproximadamente 2480 por 3508 píxeles.

Para pantallas y la web, piense en el espacio que ocupará la imagen. Una imagen que se muestra con 800 píxeles de ancho en una página web rara vez necesita más del doble para verse nítida en pantallas de alta densidad. Cualquier tamaño mayor solo hace que la página tarde más en cargarse.

## Relación de aspecto

La relación de aspecto es la forma de la imagen: el ancho en comparación con el alto, como 16:9 o 1:1. Si cambia el ancho y el alto en proporciones distintas, la imagen se aplasta o se estira. Universal Images mantiene la relación bloqueada salvo que usted elija lo contrario, y sus ajustes predefinidos para redes sociales recortan la imagen a la forma de cada plataforma en lugar de deformarla.`,
  },
  {
    id: 'what-compression-does',
    title: '¿Qué hace realmente la compresión?',
    summary: 'La compresión con y sin pérdida, y qué cambia el control de calidad.',
    group: 'Conceptos básicos',
    body: `Una foto sin comprimir es enorme. Doce millones de píxeles, cada uno con varios bytes para su color, suman decenas de megabytes. La compresión es la forma en que los formatos de imagen hacen que eso sea manejable.

## Compresión sin pérdida

La compresión sin pérdida busca patrones y repeticiones y los escribe de forma más eficiente, un poco como escribir "100 píxeles azules" en lugar de enumerar cada uno. Al abrir la imagen, cada píxel vuelve exactamente como estaba. PNG es sin pérdida. Funciona muy bien con gráficos que tienen grandes zonas de color plano y mucho peor con fotos, en las que los píxeles vecinos rara vez son idénticos.

## Compresión con pérdida

La compresión con pérdida va más allá y descarta información que difícilmente se notará, como variaciones muy finas de color o textura. JPEG, y WebP y AVIF en sus modos habituales, son con pérdida. El resultado puede ser un archivo muchas veces más pequeño que el original con poca diferencia visible. La información descartada se pierde para siempre.

## El control de calidad

Cuando guarda en JPEG, WebP o AVIF, el control de calidad determina cuánto puede descartar el codificador. Una calidad más alta significa un archivo más grande que conserva más detalle. Una calidad más baja significa un archivo más pequeño y, llegado un punto, problemas visibles:

- cuadrados pixelados en zonas lisas, como el cielo
- detalles finos emborronados, como el pelo o la hierba
- ondulaciones tenues alrededor de los bordes nítidos y del texto

La relación no es uniforme. Bajar desde lo más alto de la escala suele ahorrar mucho espacio sin cambios visibles, mientras que bajar cerca del extremo inferior ahorra poco y se ve mucho peor. PNG es sin pérdida, así que no tiene ajuste de calidad.

## Consejos prácticos

- **Primero, cambie el tamaño.** Reducir las dimensiones en píxeles a lo que realmente necesita suele ahorrar mucho más que bajar la calidad.
- **Fíjese en la estimación.** Universal Images actualiza el tamaño de archivo previsto mientras mueve el control. Mire la vista previa y busque el ajuste más bajo que le satisfaga.
- **Evite guardar una y otra vez.** Cada guardado con pérdida descarta un poco más. Si necesita hacer más cambios, vuelva al original en lugar de volver a editar una copia ya comprimida.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'Cómo funciona Universal Images',
    summary: 'Dónde se hace el trabajo, qué hacen las herramientas de IA y cuáles son sus límites.',
    group: 'Cómo funciona',
    body: `Universal Images hace todo el trabajo con las imágenes en su propio dispositivo. No hay ningún servidor de procesamiento. Cuando añade una imagen, la aplicación lee el archivo y todos los pasos posteriores se hacen en la propia aplicación.

## Redimensionar y convertir

La aplicación dibuja su imagen en un lienzo interno al tamaño que elija y después la guarda en el formato y la calidad que indique. Cuando reduce mucho una imagen, lo hace en varios pasos, reduciéndola a la mitad cada vez en lugar de hacerlo de una sola vez, lo que evita los bordes dentados y parpadeantes que puede producir una única reducción grande.

El recorte funciona de la misma manera: solo se dibuja en la nueva imagen la parte que queda dentro del recorte. Los ajustes predefinidos para redes sociales recortan y dimensionan la imagen según la forma de cada plataforma, y puede arrastrar para elegir qué queda dentro del encuadre.

La exportación por lotes aplica el formato y el tamaño elegidos a todas las imágenes que haya añadido y las descarga juntas en un solo archivo ZIP.

## Eliminar el fondo

Eliminar fondo usa un modelo de IA que separa el sujeto de su fondo. El modelo se ejecuta en su dispositivo. La primera vez que lo use, es posible que la aplicación tenga que descargar el modelo, que es grande y que después se queda guardado en su dispositivo para que los usos posteriores sean más rápidos. Esa descarga es el propio modelo, el mismo para todo el mundo; su imagen no se envía a ningún sitio.

Funciona mejor con un sujeto claro sobre un fondo bien diferenciado. El pelo fino, el cristal y las escenas recargadas pueden confundirlo, así que revise los bordes antes de usar el resultado.

## Difuminar caras

Difuminar caras usa un pequeño modelo de detección de caras, que también se ejecuta en su dispositivo, para encontrar las caras y después difuminarlas o pixelarlas. Puede activar o desactivar cada cara por separado y cambiar la intensidad.

La detección automática es una ayuda, no una garantía. Puede pasar por alto caras pequeñas, lejanas, de espaldas o parcialmente ocultas. Revise siempre el resultado antes de compartirlo y use un ajuste fuerte: un difuminado ligero o unos píxeles grandes y suaves pueden dejar una cara reconocible.

## Collages

La herramienta de collage coloca varias fotos una al lado de otra, apiladas o en cuadrícula, con espaciado, esquinas y fondo ajustables. Puede descargar el collage o volver a añadirlo a sus imágenes para redimensionarlo o convertirlo.

## Trabajar sin conexión

Redimensionar, recortar, convertir y leer metadatos funcionan sin ninguna conexión. Eliminar el fondo y difuminar caras solo necesitan conexión para la primera descarga de sus modelos.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Metadatos de las fotos y datos de ubicación',
    summary: 'Qué puede revelar una foto sobre dónde y cuándo se hizo, y cómo eliminarlo.',
    group: 'Privacidad y seguridad',
    body: `La mayoría de las fotos llevan algo más que la imagen. Las cámaras y los teléfonos escriben información adicional, llamada metadatos, en el archivo. El tipo más común se conoce como EXIF. Puede incluir:

- la fecha y la hora en que se hizo la foto
- la marca y el modelo de la cámara o el teléfono, a veces un número de serie
- ajustes de la cámara, como la exposición y la distancia focal
- el programa usado para editarla y, a veces, el nombre de un autor o propietario
- **coordenadas GPS** que muestran dónde se hizo la foto, a menudo con una precisión de pocos metros
- una pequeña miniatura de vista previa, que puede seguir mostrando la imagen original después de haber recortado o editado la imagen principal

Gran parte de esto se conserva cuando una foto se envía por correo electrónico o como archivo. Algunos sitios web y aplicaciones lo eliminan al subirla, pero muchos no, y no siempre se puede saber cuáles.

## Ver lo que contiene una foto

Universal Images puede mostrarle los metadatos de una foto y resaltar las partes que apuntan a una persona, un lugar o un dispositivo. Si la foto tiene coordenadas GPS, la aplicación dibuja un pequeño mapa que muestra el país y en qué parte de él se hizo la foto.

Ese mapa se dibuja a partir de contornos de países que vienen con la aplicación, así que mostrarlo no le dice a nadie dónde se hizo la foto. Si quiere más detalle, hay un botón para acercarse a la provincia o región y a la localidad más cercana. Al pulsarlo se carga un archivo de límites de ese país concreto. En la versión web de la aplicación, eso significa descargarlo del sitio web de Universal Images. La solicitud indica el país, pero no incluye ninguna coordenada, y solo se produce cuando pulsa el botón. La aplicación nunca busca una dirección postal.

## Eliminar los metadatos

Hay dos formas de obtener una copia limpia:

- **Eliminar metadatos**, en el panel de metadatos, elimina los metadatos de los archivos JPEG, PNG y WebP sin volver a comprimir la imagen, así que la calidad no se ve afectada. Se conserva la información de color necesaria para mostrar la imagen correctamente.
- **Cualquier exportación** desde la aplicación es una imagen creada de nuevo. Redimensionar, convertir, recortar o simplemente descargar a través de la aplicación produce un archivo que no lleva los datos EXIF del original, incluida su ubicación.

Hay una excepción que conviene conocer: la copia de seguridad de Guardar en el escritorio conserva a propósito su imagen original para que pueda seguir editándola más adelante. Si el original tenía datos de ubicación, la copia de seguridad también los tiene. Elimine antes los metadatos si eso le importa.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'Lo que sale de su dispositivo',
    summary: 'Exactamente qué se queda en su dispositivo, y las pocas cosas que se envían a internet.',
    group: 'Privacidad y seguridad',
    body: `Universal Images está diseñado para que sus imágenes se queden con usted. Esto es exactamente lo que ocurre.

## Se queda en su dispositivo

- **Sus imágenes.** Abrir, recortar, redimensionar, convertir, eliminar metadatos, crear collages, eliminar fondos y difuminar caras se hace todo en su dispositivo. Sus imágenes no se suben para procesarlas.
- **Descargas y copias de seguridad.** Descargar guarda el resultado en su dispositivo. Guardar en el escritorio crea un archivo de copia de seguridad que conserva usted mismo.

## Descargas que no son subidas

La primera vez que use la eliminación de fondo o el difuminado de caras, es posible que la aplicación tenga que descargar el modelo de IA que necesita desde una red de distribución de contenidos. El modelo es un archivo fijo, el mismo para todo el mundo. Esos servidores ven una solicitud normal desde su conexión, como en cualquier descarga, pero no reciben su imagen. La imagen la procesa el modelo en su dispositivo.

Si acerca el mapa de ubicación al nivel de provincia o región, la versión web de la aplicación descarga el archivo de límites de un país desde el sitio web de Universal Images. Esa solicitud indica el país, no las coordenadas de la foto.

## Solo cuando usted lo decide: guardar en internet

Si inicia sesión con su Universal ID y decide guardar una imagen en UNI·SIM, la aplicación sube la imagen terminada, la misma que le daría el botón Descargar, para que pueda recuperarla en otro dispositivo. Cada imagen guardada usa un token, y al eliminarla se le devuelve el token y se borra del almacenamiento.

Se trata de un almacenamiento en la nube normal, no de un cifrado de extremo a extremo. Está cifrado en tránsito y en reposo y el acceso está limitado a su cuenta, pero nosotros tenemos las claves. Si eso le importa en el caso de una imagen concreta, no la guarde; la aplicación funciona por completo sin cuenta.

## Lo que envían todas las aplicaciones Universal

Mientras la aplicación está abierta, envía a nuestro servidor una pequeña señal de que se está usando, para que el menú pueda mostrar cuántas personas la usan. Esa señal contiene el nombre de la aplicación, el tipo de dispositivo (web, teléfono u ordenador), un identificador aleatorio creado en este dispositivo y, si ha iniciado sesión, su cuenta. Si ha iniciado sesión, la aplicación también registra que la ha abierto, para la página de actividad de su cuenta. Ninguna de las dos incluye nada sobre sus imágenes: ni sus nombres, ni sus tamaños, ni su contenido.

La aplicación no incluye analítica, seguimiento ni publicidad de terceros.`,
  },
]

export default articles
