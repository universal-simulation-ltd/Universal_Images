import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: "Imagens raster e vetoriais",
    summary: "Por que fotos ficam borradas quando ampliadas, e logotipos não.",
    group: "O básico",
    body: `Existem duas formas fundamentalmente diferentes de guardar uma imagem em um computador.

## Imagens raster

Uma imagem raster é uma grade de quadradinhos coloridos chamados pixels. Uma foto de celular pode ter 4.000 pixels de largura e 3.000 de altura, o que dá doze milhões de pixels, cada um com a sua própria cor. JPEG, PNG, WebP, AVIF, HEIC e GIF são todos formatos raster.

Imagens raster são ideais para fotografias, em que cada pixel pode ser um pouco diferente. O limite delas é que o número de pixels é fixo. Reduzir uma imagem raster descarta pixels. Ampliá-la significa inventar pixels que nunca existiram, e é por isso que uma imagem pequena esticada para ocupar a tela fica suave demais ou quadriculada. Nenhum programa consegue recuperar detalhes que não foram capturados.

## Imagens vetoriais

Uma imagem vetorial não guarda pixels. Ela guarda instruções: desenhe um círculo aqui, uma curva deste ponto até aquele, preencha esta forma de laranja. SVG é o formato vetorial mais comum na web. Como as formas são descritas matematicamente, uma imagem vetorial pode ser desenhada em qualquer tamanho e continua perfeitamente nítida.

Vetores são ideais para logotipos, ícones, diagramas e texto. Não servem para fotografias, porque uma foto não tem formas bem definidas para descrever.

## Como o Universal Images lida com elas

O Universal Images trabalha com imagens raster. Quando você adiciona um SVG, o app o desenha uma vez em pixels para que ele possa ser recortado, redimensionado e convertido como qualquer outra imagem. O resultado é uma imagem raster, então escolha o tamanho de que precisa antes de exportar. Se você precisa de um logotipo em vários tamanhos, guarde o SVG original e exporte cada tamanho a partir dele, em vez de ampliar uma exportação pequena.

## Uma regra útil

- Reduza à vontade. Diminuir uma imagem raster costuma ficar bom.
- Evite deixar imagens raster maiores do que o tamanho original. O app consegue fazer isso, mas não consegue acrescentar detalhes reais.
- Se você tem um original vetorial, guarde-o. Ele é a cópia principal.`,
  },
  {
    id: 'image-formats',
    title: "JPEG, PNG, WebP, AVIF e HEIC: qual usar?",
    summary: "No que cada formato é bom, e qual escolher na hora de salvar.",
    group: "O básico",
    body: `Formatos de imagem são formas diferentes de empacotar pixels em um arquivo. Cada um faz concessões diferentes entre tamanho do arquivo, qualidade, transparência e o quanto é amplamente suportado.

## Os formatos

- **JPEG** é o formato clássico para fotos. Ele usa compressão com perdas, que mantém os arquivos pequenos descartando detalhes que o olho dificilmente percebe. Não suporta transparência. Quase tudo consegue abrir um JPEG.
- **PNG** usa compressão sem perdas, então cada pixel é mantido exatamente. Suporta transparência. É ideal para capturas de tela, gráficos com bordas nítidas e texto, e recortes. Fotos salvas em PNG costumam ficar bem maiores do que a mesma foto em JPEG.
- **WebP** é um formato mais recente, criado para a web. Pode ser com ou sem perdas e suporta transparência. Para fotos, costuma ser menor do que um JPEG de qualidade parecida. Todos os principais navegadores atuais o suportam, embora alguns programas mais antigos não.
- **AVIF** é ainda mais recente e muitas vezes gera arquivos menores do que o WebP com qualidade parecida. O suporte está crescendo, mas é menos universal, e nem todo navegador consegue criar arquivos AVIF.
- **HEIC** é o formato que muitos iPhones usam para fotos. É eficiente, mas muitos sites e programas do Windows não conseguem abri-lo.
- **GIF** é um formato antigo limitado a 256 cores, mais conhecido por animações curtas.

## O que o Universal Images consegue abrir e salvar

O app abre JPEG, PNG, WebP, AVIF, HEIC, GIF e SVG. Ele salva em JPEG, PNG, WebP ou AVIF. O AVIF só é oferecido quando o dispositivo que você está usando consegue criá-lo.

Fotos HEIC são convertidas em um JPEG de alta qualidade ao serem abertas, para que o resto do app possa trabalhar com elas. Um GIF animado vira uma única imagem estática.

## Qual escolher?

- **Compartilhar uma foto com qualquer pessoa, em qualquer lugar:** JPEG.
- **Uma foto para o seu próprio site:** WebP, ou AVIF se o seu site suportar.
- **Um logotipo, uma captura de tela ou qualquer coisa com texto:** PNG.
- **Um recorte com fundo transparente:** PNG ou WebP. O JPEG não consegue guardar transparência.
- **Uma foto de iPhone que alguém não consegue abrir:** converta para JPEG.

O app mostra uma estimativa do tamanho do arquivo conforme você muda o formato e a qualidade, então vale a pena testar duas ou três opções e comparar.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: "Pixels, resolução e DPI",
    summary: "O que o tamanho de uma imagem realmente significa na tela e no papel.",
    group: "O básico",
    body: `As pessoas usam a palavra resolução para se referir a várias coisas diferentes, o que causa muita confusão. Veja o que realmente importa.

## O que conta são as dimensões em pixels

O dado mais importante sobre uma imagem digital são as suas dimensões em pixels: quantos pixels de largura e quantos de altura, por exemplo 1920 por 1080. Esse número diz quanto detalhe a imagem contém. O Universal Images mostra e trabalha com dimensões em pixels.

## DPI é só uma instrução para impressão

DPI, ou PPI, significa pontos ou pixels por polegada. É uma anotação guardada em alguns arquivos de imagem que diz à impressora em que tamanho imprimir os pixels. Ela não altera os pixels em si. Uma imagem de 3.000 por 2.000 pixels tem exatamente o mesmo detalhe, quer o arquivo diga 72 DPI, quer diga 300 DPI. A única diferença é o tamanho com que ela sai no papel.

Na tela, a configuração de DPI é ignorada. A tela simplesmente mostra pixels.

## Como calcular o tamanho de que você precisa

Para impressão, uma referência comum é cerca de 300 pixels por polegada para fotos vistas de perto, e menos para coisas vistas de longe, como cartazes. Para calcular os pixels de que você precisa, multiplique o tamanho da impressão em polegadas pelos pixels por polegada. Uma polegada tem 2,54 cm.

1. Uma foto de 6 por 4 polegadas a 300 pixels por polegada precisa de 1800 por 1200 pixels.
2. Uma página A4 tem cerca de 8,3 por 11,7 polegadas, então a 300 pixels por polegada ela precisa de aproximadamente 2480 por 3508 pixels.

Para telas e para a web, pense no espaço que a imagem vai ocupar. Uma imagem exibida com 800 pixels de largura em uma página da web raramente precisa ter mais do que cerca do dobro disso para ficar nítida em telas de alta densidade. Qualquer coisa maior só deixa a página mais lenta para carregar.

## Proporção

A proporção é o formato da imagem: a largura em relação à altura, como 16:9 ou 1:1. Se você muda a largura e a altura em quantidades diferentes, a imagem fica achatada ou esticada. O Universal Images mantém a proporção travada, a menos que você escolha o contrário, e as predefinições para redes sociais recortam a imagem no formato de cada plataforma em vez de distorcê-la.`,
  },
  {
    id: 'what-compression-does',
    title: "O que a compressão faz, afinal?",
    summary: "Compressão com e sem perdas, e o que o controle de qualidade muda.",
    group: "O básico",
    body: `Uma foto sem compressão é enorme. Doze milhões de pixels, cada um precisando de vários bytes para a sua cor, somam dezenas de megabytes. A compressão é a forma como os formatos de imagem tornam isso administrável.

## Compressão sem perdas

A compressão sem perdas encontra padrões e repetições e os escreve de forma mais eficiente, mais ou menos como escrever "100 pixels azuis" em vez de listar cada um. Quando a imagem é aberta, cada pixel volta exatamente como era. O PNG é sem perdas. Ele funciona muito bem em gráficos com grandes áreas de cor uniforme e bem menos em fotos, em que pixels vizinhos raramente são idênticos.

## Compressão com perdas

A compressão com perdas vai além, descartando informações que as pessoas dificilmente vão notar, como variações muito sutis de cor ou textura. O JPEG, e o WebP e o AVIF nos seus modos habituais, são com perdas. O resultado pode ser um arquivo muitas vezes menor do que o original, com pouca diferença visível. A informação descartada se perde para sempre.

## O controle de qualidade

Quando você salva em JPEG, WebP ou AVIF, o controle de qualidade define quanto o codificador pode descartar. Qualidade mais alta significa um arquivo maior, com mais detalhes preservados. Qualidade mais baixa significa um arquivo menor e, a partir de certo ponto, problemas visíveis:

- quadrados em blocos em áreas lisas, como o céu
- detalhes finos borrados, como cabelo ou grama
- ondulações leves em volta de bordas nítidas e de texto

A relação não é uniforme. Descer do topo da escala muitas vezes economiza bastante espaço sem mudança visível, enquanto descer perto do fim economiza pouco e fica bem pior. O PNG é sem perdas, então não tem configuração de qualidade.

## Dicas práticas

- **Redimensione primeiro.** Reduzir as dimensões em pixels ao que você realmente precisa costuma economizar muito mais do que baixar a qualidade.
- **Acompanhe a estimativa.** O Universal Images atualiza o tamanho previsto do arquivo conforme você move o controle. Olhe a prévia e encontre a configuração mais baixa que ainda lhe agrade.
- **Evite salvar várias e várias vezes.** Cada salvamento com perdas descarta um pouco mais. Se precisar fazer outras alterações, volte ao original em vez de reeditar uma cópia já comprimida.`,
  },
  {
    id: 'how-universal-images-works',
    title: "Como o Universal Images funciona",
    summary: "Onde o trabalho acontece, o que as ferramentas de IA fazem e seus limites.",
    group: "Como funciona",
    body: `O Universal Images faz todo o trabalho com imagens no seu próprio dispositivo. Não há servidor de processamento. Quando você adiciona uma imagem, o app lê o arquivo, e todas as etapas seguintes acontecem no próprio app.

## Redimensionar e converter

O app desenha a sua imagem em uma tela interna no tamanho que você escolher e depois a salva no formato e na qualidade que você definir. Quando reduz muito uma imagem, ele faz isso em várias etapas, pela metade de cada vez, em vez de tudo de uma só vez, o que evita as bordas serrilhadas e tremidas que uma única redução grande pode gerar.

O recorte funciona da mesma forma: só a parte dentro do recorte é desenhada na nova imagem. As predefinições para redes sociais recortam e dimensionam a imagem no formato de cada plataforma, e você pode arrastar para escolher o que fica no enquadramento.

A exportação em lote aplica o formato e o tamanho escolhidos a todas as imagens que você adicionou e baixa todas juntas em um único arquivo ZIP.

## Remoção de fundo

Remover fundo usa um modelo de IA que separa o objeto principal do fundo. O modelo roda no seu dispositivo. Na primeira vez que você o usa, o app pode precisar baixar o modelo, que é grande e depois fica guardado no seu dispositivo para que os próximos usos sejam mais rápidos. Esse download é o próprio modelo, o mesmo para todo mundo; a sua imagem não é enviada para lugar nenhum.

Funciona melhor com um objeto bem definido contra um fundo distinto. Cabelos finos, vidro e cenas carregadas podem confundi-lo, então confira as bordas antes de usar o resultado.

## Desfocar rostos

Desfocar rostos usa um pequeno modelo de detecção de rostos, que também roda no seu dispositivo, para encontrar rostos e depois desfocá-los ou pixelá-los. Você pode ativar ou desativar rostos individualmente e mudar a intensidade.

A detecção automática é uma ajuda, não uma garantia. Ela pode deixar passar rostos pequenos, distantes, virados ou parcialmente escondidos. Sempre revise o resultado antes de compartilhar e use uma intensidade forte: um desfoque leve ou pixels grandes e suaves podem deixar um rosto reconhecível.

## Colagens

A ferramenta de colagem organiza várias fotos lado a lado, empilhadas ou em grade, com espaçamento, cantos e fundo ajustáveis. Você pode baixar a colagem ou adicioná-la de volta às suas imagens para redimensioná-la ou convertê-la.

## Trabalhar offline

Redimensionar, recortar, converter e ler metadados funcionam sem nenhuma conexão. A remoção de fundo e o desfoque de rostos só precisam de conexão para o primeiro download dos seus modelos.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: "Metadados de fotos e dados de localização",
    summary: "O que uma foto pode revelar sobre onde e quando foi tirada, e como remover isso.",
    group: "Privacidade e segurança",
    body: `A maioria das fotos carrega mais do que a imagem. Câmeras e celulares gravam informações extras, chamadas metadados, no arquivo. O tipo mais comum é conhecido como EXIF. Ele pode incluir:

- a data e a hora em que a foto foi tirada
- a marca e o modelo da câmera ou do celular, às vezes um número de série
- configurações da câmera, como exposição e distância focal
- o programa usado para editá-la e, às vezes, o nome de um autor ou proprietário
- **coordenadas de GPS** mostrando onde a foto foi tirada, muitas vezes com precisão de poucos metros
- uma pequena miniatura de prévia, que ainda pode mostrar a imagem original depois que a imagem principal foi recortada ou editada

Boa parte disso se mantém quando uma foto é enviada por e-mail ou como arquivo. Alguns sites e apps removem esses dados quando você faz o upload, mas muitos não, e nem sempre dá para saber quais.

## Ver o que uma foto contém

O Universal Images pode mostrar os metadados de uma foto, destacando as partes que apontam para uma pessoa, um lugar ou um dispositivo. Se a foto tiver coordenadas de GPS, o app desenha um pequeno mapa mostrando o país e em que parte dele a foto foi tirada.

Esse mapa é desenhado a partir de contornos de países que vêm com o app, então exibi-lo não informa a ninguém onde a foto foi tirada. Se quiser mais detalhes, há um botão para aproximar até o nível de condado e da cidade mais próxima. Tocar nele carrega um arquivo de limites daquele único país. Na versão web do app, isso significa baixá-lo do site do Universal Images. A solicitação informa o país, mas não leva nenhuma coordenada, e só acontece quando você toca no botão. O app nunca busca um endereço de rua.

## Remover metadados

Há duas formas de obter uma cópia limpa:

- **Remover metadados**, no painel de metadados, remove os metadados de arquivos JPEG, PNG e WebP sem comprimir a imagem de novo, então a qualidade da imagem não é afetada. As informações de cor necessárias para exibir a imagem corretamente são mantidas.
- **Qualquer exportação** feita no app é uma imagem criada do zero. Redimensionar, converter, recortar ou simplesmente baixar pelo app gera um arquivo que não carrega os dados EXIF do original, incluindo a localização.

Uma exceção que você precisa conhecer: o backup Salvar na área de trabalho mantém de propósito a sua imagem original, para que você possa continuar editando depois. Se o original tinha dados de localização, o backup também tem. Remova os metadados antes, se isso for importante.`,
  },
  {
    id: 'what-leaves-your-device',
    title: "O que sai do seu dispositivo",
    summary: "Exatamente o que fica no seu dispositivo, e as poucas coisas que vão para a internet.",
    group: "Privacidade e segurança",
    body: `O Universal Images foi feito para que as suas imagens fiquem com você. Veja exatamente o que acontece.

## Fica no seu dispositivo

- **Suas imagens.** Abrir, recortar, redimensionar, converter, remover metadados, criar colagens, remover fundos e desfocar rostos, tudo isso acontece no seu dispositivo. Suas imagens não são enviadas para processamento.
- **Downloads e backups.** Baixar salva o resultado no seu dispositivo. Salvar na área de trabalho cria um arquivo de backup que você mesmo guarda.

## Downloads que não são uploads

Na primeira vez que você usa a remoção de fundo ou o desfoque de rostos, o app pode baixar o modelo de IA de que precisa a partir de uma rede de distribuição de conteúdo. O modelo é um arquivo fixo, o mesmo para todo mundo. Esses servidores veem uma solicitação comum vinda da sua conexão, como em qualquer download, mas não recebem a sua imagem. A imagem é processada pelo modelo no seu dispositivo.

Se você aproximar o mapa de localização até o nível de condado, a versão web do app baixa o arquivo de limites de um país do site do Universal Images. Essa solicitação informa o país, não as coordenadas da foto.

## Só quando você escolhe: armazenamento na internet

Se você entrar com o seu Universal ID e escolher guardar uma imagem na UNI·SIM, o app envia a imagem final, a mesma que o botão Baixar lhe daria, para que você possa recuperá-la em outro dispositivo. Guardar imagens online é gratuito com um Universal ID. Contas gratuitas têm um limite generoso; se algum dia você chegar a ele, exclua uma imagem de que não precisa mais. Excluir uma imagem a remove do armazenamento.

Isso é um armazenamento em nuvem comum, não criptografia de ponta a ponta. É criptografado em trânsito e em repouso, e o acesso é limitado à sua conta, mas nós temos as chaves. Se isso for importante para uma imagem específica, não a guarde; o app funciona completamente sem conta.

## O que todo app Universal envia

Enquanto o app está aberto, ele envia ao nosso servidor um pequeno sinal de que está em uso, para que o menu possa mostrar quantas pessoas o usam. Esse sinal contém o nome do app, o tipo de dispositivo (web, celular ou computador), um ID aleatório criado neste dispositivo e, se você tiver entrado, a sua conta. Se você tiver entrado, o app também registra que você o abriu, para a página de atividade da sua conta. Nenhum dos dois inclui nada sobre as suas imagens: nem os nomes, nem os tamanhos, nem o conteúdo.

Não há análise de dados, rastreamento nem publicidade de terceiros no app.`,
  },
]

export default articles
