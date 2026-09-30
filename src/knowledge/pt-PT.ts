import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Imagens rasterizadas e vetoriais',
    summary: 'Porque é que as fotografias ficam desfocadas quando ampliadas, e os logótipos não.',
    group: 'O essencial',
    body: `Há duas formas fundamentalmente diferentes de guardar uma imagem num computador.

## Imagens rasterizadas

Uma imagem rasterizada é uma grelha de pequenos quadrados coloridos chamados píxeis. Uma fotografia tirada com um telemóvel pode ter 4000 píxeis de largura e 3000 de altura, ou seja, doze milhões de píxeis, cada um com a sua cor. JPEG, PNG, WebP, AVIF, HEIC e GIF são todos formatos rasterizados.

As imagens rasterizadas são ideais para fotografias, em que cada píxel pode ser ligeiramente diferente. O seu limite é que o número de píxeis é fixo. Reduzir uma imagem rasterizada deita píxeis fora. Ampliá-la obriga a inventar píxeis que nunca existiram, e é por isso que uma imagem pequena esticada para encher um ecrã parece desfocada ou pixelizada. Nenhum programa consegue recuperar detalhe que não foi captado.

## Imagens vetoriais

Uma imagem vetorial não guarda píxeis. Guarda instruções: desenhar aqui um círculo, uma curva deste ponto até àquele, preencher esta forma de laranja. O SVG é o formato vetorial mais comum na web. Como as formas são descritas matematicamente, uma imagem vetorial pode ser desenhada em qualquer tamanho e mantém-se perfeitamente nítida.

Os vetores adequam-se a logótipos, ícones, diagramas e texto. Não se adequam a fotografias, porque uma fotografia não tem formas limpas para descrever.

## Como o Universal Images os trata

O Universal Images trabalha com imagens rasterizadas. Quando adiciona um SVG, a aplicação desenha-o uma vez em píxeis para que possa ser recortado, redimensionado e convertido como qualquer outra imagem. O resultado é uma imagem rasterizada, por isso escolha o tamanho de que precisa antes de exportar. Se precisar de um logótipo em vários tamanhos, guarde o SVG original e exporte cada tamanho a partir dele, em vez de ampliar uma exportação pequena.

## Uma regra útil

- Reduza à vontade. Diminuir uma imagem rasterizada costuma dar bom resultado.
- Evite aumentar imagens rasterizadas para lá do tamanho original. A aplicação consegue fazê-lo, mas não consegue acrescentar detalhe real.
- Se tiver um original vetorial, guarde-o. É a cópia mestre.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF e HEIC: qual usar?',
    summary: 'Para que serve cada formato, e qual escolher ao guardar.',
    group: 'O essencial',
    body: `Os formatos de imagem são diferentes formas de arrumar píxeis num ficheiro. Cada um faz compromissos diferentes entre tamanho do ficheiro, qualidade, transparência e compatibilidade.

## Os formatos

- **JPEG** é o formato clássico para fotografias. Usa compressão com perdas, que mantém os ficheiros pequenos descartando detalhe que dificilmente o olho nota. Não suporta transparência. Quase tudo consegue abrir um JPEG.
- **PNG** usa compressão sem perdas, por isso cada píxel é mantido exatamente. Suporta transparência. É ideal para capturas de ecrã, gráficos com contornos nítidos e texto, e recortes. As fotografias guardadas em PNG são normalmente muito maiores do que a mesma fotografia em JPEG.
- **WebP** é um formato mais recente, pensado para a web. Pode ser com ou sem perdas e suporta transparência. Para fotografias, é tipicamente mais pequeno do que um JPEG de qualidade semelhante. Todos os principais navegadores atuais o suportam, embora alguns programas mais antigos não.
- **AVIF** é ainda mais recente e produz muitas vezes ficheiros mais pequenos do que o WebP com qualidade semelhante. O suporte está a crescer mas é menos universal, e nem todos os navegadores conseguem criar ficheiros AVIF.
- **HEIC** é o formato que muitos iPhones usam para fotografias. É eficiente, mas muitos sites e programas do Windows não o conseguem abrir.
- **GIF** é um formato antigo limitado a 256 cores, conhecido sobretudo pelas animações curtas.

## O que o Universal Images consegue abrir e guardar

A aplicação abre JPEG, PNG, WebP, AVIF, HEIC, GIF e SVG. Guarda em JPEG, PNG, WebP ou AVIF. O AVIF só é oferecido quando o dispositivo que está a usar o consegue criar.

As fotografias HEIC são convertidas num JPEG de alta qualidade ao serem abertas, para que o resto da aplicação possa trabalhar com elas. Um GIF animado passa a ser uma única imagem fixa.

## Qual deve escolher?

- **Partilhar uma fotografia com qualquer pessoa, em qualquer lado:** JPEG.
- **Uma fotografia para o seu próprio site:** WebP, ou AVIF se o seu site o suportar.
- **Um logótipo, uma captura de ecrã ou qualquer coisa com texto:** PNG.
- **Um recorte com fundo transparente:** PNG ou WebP. O JPEG não consegue guardar transparência.
- **Uma fotografia de iPhone que alguém não consegue abrir:** converta-a para JPEG.

A aplicação mostra uma estimativa do tamanho do ficheiro à medida que altera o formato e a qualidade, por isso vale a pena experimentar duas ou três opções e comparar.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Píxeis, resolução e DPI',
    summary: 'O que significa realmente o tamanho de uma imagem num ecrã e em papel.',
    group: 'O essencial',
    body: `A palavra resolução é usada com vários sentidos diferentes, o que gera muita confusão. Eis o que realmente importa.

## O que conta são as dimensões em píxeis

O dado mais importante de uma imagem digital são as suas dimensões em píxeis: quantos píxeis tem de largura e quantos de altura, por exemplo 1920 por 1080. Esse número indica quanto detalhe a imagem contém. O Universal Images mostra e trabalha com dimensões em píxeis.

## O DPI é apenas uma instrução para impressão

DPI, ou PPI, significa pontos ou píxeis por polegada. É uma nota guardada em alguns ficheiros de imagem que indica à impressora com que tamanho deve imprimir os píxeis. Não altera os píxeis em si. Uma imagem de 3000 por 2000 píxeis contém exatamente o mesmo detalhe, quer o ficheiro diga 72 DPI quer diga 300 DPI. A única diferença é o tamanho com que sai no papel.

Num ecrã, a definição de DPI é ignorada. Um ecrã limita-se a mostrar píxeis.

## Calcular o tamanho de que precisa

Para impressão, uma orientação comum é cerca de 300 píxeis por polegada para fotografias vistas de perto, e menos para coisas vistas à distância, como cartazes. Para calcular os píxeis de que precisa, multiplique o tamanho de impressão em polegadas pelos píxeis por polegada. Uma polegada tem 2,54 cm.

1. Uma fotografia de 6 por 4 polegadas a 300 píxeis por polegada precisa de 1800 por 1200 píxeis.
2. Uma página A4 tem cerca de 8,3 por 11,7 polegadas, por isso a 300 píxeis por polegada precisa de aproximadamente 2480 por 3508 píxeis.

Para ecrãs e para a web, pense no espaço que a imagem vai ocupar. Uma imagem mostrada com 800 píxeis de largura numa página web raramente precisa de mais do que cerca do dobro disso para se manter nítida em ecrãs de alta densidade. Qualquer coisa maior só torna a página mais lenta a carregar.

## Proporção

A proporção é a forma da imagem: a largura comparada com a altura, como 16:9 ou 1:1. Se alterar a largura e a altura em quantidades diferentes, a imagem fica achatada ou esticada. O Universal Images mantém a proporção bloqueada, a menos que escolha o contrário, e as suas predefinições para redes sociais recortam a imagem no formato de cada plataforma em vez de a deformar.`,
  },
  {
    id: 'what-compression-does',
    title: 'O que faz realmente a compressão?',
    summary: 'Compressão com e sem perdas, e o que muda o controlo de qualidade.',
    group: 'O essencial',
    body: `Uma fotografia sem compressão é enorme. Doze milhões de píxeis, cada um a precisar de vários bytes para a sua cor, somam dezenas de megabytes. A compressão é a forma como os formatos de imagem tornam isso gerível.

## Compressão sem perdas

A compressão sem perdas encontra padrões e repetições e escreve-os de forma mais eficiente, um pouco como escrever "100 píxeis azuis" em vez de enumerar cada um. Quando a imagem é aberta, cada píxel volta exatamente como estava. O PNG é sem perdas. Funciona muito bem em gráficos com grandes áreas de cor lisa e bastante pior em fotografias, em que os píxeis vizinhos raramente são idênticos.

## Compressão com perdas

A compressão com perdas vai mais longe, deitando fora informação que dificilmente alguém nota, como variações muito finas de cor ou textura. O JPEG, e o WebP e o AVIF nos seus modos habituais, são com perdas. O resultado pode ser um ficheiro muitas vezes mais pequeno do que o original, com pouca diferença visível. A informação descartada perde-se para sempre.

## O controlo de qualidade

Quando guarda em JPEG, WebP ou AVIF, o controlo de qualidade define quanto o codificador pode descartar. Uma qualidade mais alta significa um ficheiro maior, com mais detalhe preservado. Uma qualidade mais baixa significa um ficheiro mais pequeno e, a partir de certo ponto, problemas visíveis:

- quadrados em blocos em zonas uniformes, como céus
- detalhe fino esborratado, como cabelo ou relva
- ondulações ténues à volta de contornos nítidos e de texto

A relação não é uniforme. Descer a partir do topo da escala poupa muitas vezes bastante espaço sem diferença visível, enquanto descer perto do fundo poupa pouco e fica muito pior. O PNG é sem perdas, por isso não tem definição de qualidade.

## Dicas práticas

- **Redimensione primeiro.** Reduzir as dimensões em píxeis ao que realmente precisa costuma poupar muito mais do que baixar a qualidade.
- **Acompanhe a estimativa.** O Universal Images atualiza o tamanho previsto do ficheiro à medida que move o controlo. Observe a pré-visualização e encontre a definição mais baixa com que fica satisfeito.
- **Evite guardar vezes sem conta.** Cada gravação com perdas descarta um pouco mais. Se precisar de fazer mais alterações, volte ao original em vez de reeditar uma cópia já comprimida.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'Como funciona o Universal Images',
    summary: 'Onde o trabalho acontece, o que fazem as ferramentas de IA, e os seus limites.',
    group: 'Como funciona',
    body: `O Universal Images faz todo o trabalho com as imagens no seu próprio dispositivo. Não há servidor de processamento. Quando adiciona uma imagem, a aplicação lê o ficheiro e todos os passos seguintes acontecem na própria aplicação.

## Redimensionar e converter

A aplicação desenha a sua imagem numa tela interna no tamanho que escolher e depois guarda-a no formato e na qualidade que definir. Quando reduz muito uma imagem, fá-lo em vários passos, reduzindo para metade de cada vez em vez de tudo de uma vez, o que evita os contornos serrilhados e tremeluzentes que uma única grande redução pode produzir.

O recorte funciona da mesma forma: só a parte dentro do recorte é desenhada na nova imagem. As predefinições para redes sociais recortam e dimensionam a imagem para corresponder ao formato de cada plataforma, e pode arrastar para escolher o que fica no enquadramento.

A exportação em lote aplica as definições de formato e tamanho escolhidas a todas as imagens que adicionou e transfere-as em conjunto num único ficheiro ZIP.

## Remoção de fundo

Remover fundo usa um modelo de IA que separa o motivo do fundo. O modelo é executado no seu dispositivo. Da primeira vez que o usar, a aplicação poderá ter de transferir o modelo, que é grande e fica depois guardado no seu dispositivo para que as utilizações seguintes sejam mais rápidas. Essa transferência é apenas o próprio modelo, igual para toda a gente; a sua imagem não é enviada para lado nenhum.

Funciona melhor com um motivo bem definido sobre um fundo distinto. Cabelo fino, vidro e cenas carregadas podem confundi-lo, por isso verifique os contornos antes de usar o resultado.

## Desfocar rostos

Desfocar rostos usa um pequeno modelo de deteção de rostos, também executado no seu dispositivo, para encontrar rostos e depois desfocá-los ou pixelizá-los. Pode ativar ou desativar rostos individualmente e alterar a intensidade.

A deteção automática é uma ajuda, não uma garantia. Pode falhar rostos pequenos, distantes, virados de lado ou parcialmente escondidos. Reveja sempre o resultado antes de partilhar e use uma intensidade forte: uma desfocagem ligeira ou píxeis grandes e suaves podem deixar um rosto reconhecível.

## Colagens

A ferramenta de colagem dispõe várias fotografias lado a lado, empilhadas ou numa grelha, com espaçamento, cantos e fundo ajustáveis. Pode transferir a colagem ou voltar a adicioná-la às suas imagens para a redimensionar ou converter.

## Trabalhar sem ligação

Redimensionar, recortar, converter e ler metadados funcionam sem qualquer ligação. A remoção de fundo e a desfocagem de rostos só precisam de ligação para a primeira transferência dos respetivos modelos.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Metadados das fotografias e dados de localização',
    summary: 'O que uma fotografia pode revelar sobre onde e quando foi tirada, e como o remover.',
    group: 'Privacidade e segurança',
    body: `A maioria das fotografias traz mais do que a imagem. As câmaras e os telemóveis escrevem no ficheiro informação adicional, chamada metadados. O tipo mais comum é conhecido como EXIF. Pode incluir:

- a data e a hora em que a fotografia foi tirada
- a marca e o modelo da câmara ou do telemóvel, por vezes um número de série
- definições da câmara, como a exposição e a distância focal
- o programa usado para a editar e, por vezes, o nome de um autor ou proprietário
- **coordenadas GPS** que mostram onde a fotografia foi tirada, muitas vezes com precisão de poucos metros
- uma pequena miniatura de pré-visualização, que pode continuar a mostrar a imagem original depois de a imagem principal ter sido recortada ou editada

Grande parte disto mantém-se quando uma fotografia é enviada por email ou como ficheiro. Alguns sites e aplicações removem-no quando a carrega, mas muitos não, e nem sempre é possível saber quais.

## Ver o que uma fotografia contém

O Universal Images pode mostrar-lhe os metadados de uma fotografia, destacando as partes que apontam para uma pessoa, um local ou um dispositivo. Se a fotografia tiver coordenadas GPS, a aplicação desenha um pequeno mapa que mostra o país e o sítio dentro dele onde a fotografia foi tirada.

Esse mapa é desenhado a partir de contornos de países incluídos na aplicação, por isso mostrá-lo não revela a ninguém onde a fotografia foi tirada. Se quiser mais pormenor, há um botão para aproximar até ao distrito e à localidade mais próxima. Premi-lo carrega um ficheiro de limites para esse país. Na versão web da aplicação, isso significa transferi-lo a partir do site do Universal Images. O pedido indica o país mas não contém coordenadas, e só acontece quando prime o botão. A aplicação nunca procura um endereço de rua.

## Remover metadados

Há duas formas de obter uma cópia limpa:

- **Remover metadados**, no painel de metadados, retira os metadados de ficheiros JPEG, PNG e WebP sem voltar a comprimir a imagem, por isso a qualidade da imagem fica intacta. A informação de cor necessária para mostrar a imagem corretamente é mantida.
- **Qualquer exportação** a partir da aplicação é uma imagem criada de novo. Redimensionar, converter, recortar ou simplesmente transferir através da aplicação produz um ficheiro que não contém os dados EXIF do original, incluindo a localização.

Há uma exceção a ter em conta: a cópia de segurança Guardar no computador mantém propositadamente a sua imagem original para que possa continuar a editá-la mais tarde. Se o original tinha dados de localização, a cópia de segurança também os tem. Se isso for importante, remova primeiro os metadados.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'O que sai do seu dispositivo',
    summary: 'Exatamente o que fica no seu dispositivo, e as poucas coisas que vão para a internet.',
    group: 'Privacidade e segurança',
    body: `O Universal Images foi feito para que as suas imagens fiquem consigo. Eis exatamente o que acontece.

## Fica no seu dispositivo

- **As suas imagens.** Abrir, recortar, redimensionar, converter, remover metadados, criar colagens, remover fundos e desfocar rostos acontece tudo no seu dispositivo. As suas imagens não são carregadas para serem processadas.
- **Transferências e cópias de segurança.** Transferir guarda o resultado no seu dispositivo. Guardar no computador cria um ficheiro de cópia de segurança que fica consigo.

## Transferências que não são carregamentos

Da primeira vez que usar a remoção de fundo ou a desfocagem de rostos, a aplicação poderá transferir o modelo de IA de que precisa a partir de uma rede de distribuição de conteúdos. O modelo é um ficheiro fixo, igual para toda a gente. Esses servidores veem um pedido normal a partir da sua ligação, como em qualquer transferência, mas não recebem a sua imagem. A imagem é processada pelo modelo no seu dispositivo.

Se aproximar o mapa de localização até ao nível do distrito, a versão web da aplicação transfere o ficheiro de limites de um país a partir do site do Universal Images. Esse pedido indica o país, não as coordenadas da fotografia.

## Só quando escolher: guardar online

Se iniciar sessão com o seu Universal ID e optar por guardar uma imagem na UNI·SIM, a aplicação carrega a imagem final, a mesma que o botão Transferir lhe daria, para que a possa recuperar noutro dispositivo. Guardar imagens online é gratuito com um Universal ID. As contas gratuitas têm um limite generoso; se alguma vez o atingir, elimine uma imagem de que já não precise. Eliminar uma imagem apaga-a do armazenamento.

Trata-se de armazenamento na nuvem comum, não de encriptação ponto a ponto. É encriptado em trânsito e em repouso e o acesso está limitado à sua conta, mas somos nós que detemos as chaves. Se isso for importante para uma determinada imagem, não a guarde; a aplicação funciona plenamente sem conta.

## O que todas as aplicações Universal enviam

Enquanto a aplicação está aberta, envia ao nosso servidor um pequeno sinal de que está a ser usada, para que o menu possa mostrar quantas pessoas a usam. Esse sinal contém o nome da aplicação, o tipo de dispositivo (web, telemóvel ou computador), um ID aleatório criado neste dispositivo e, se tiver sessão iniciada, a sua conta. Se tiver sessão iniciada, a aplicação regista também que a abriu, para a página de atividade da sua conta. Nenhum dos dois inclui qualquer informação sobre as suas imagens: nem os nomes, nem os tamanhos, nem o conteúdo.

Não há análises de terceiros, rastreio nem publicidade na aplicação.`,
  },
]

export default articles
