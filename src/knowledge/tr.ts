import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: "Raster ve vektör görüntüler",
    summary: "Fotoğraflar büyütüldüğünde neden bulanıklaşır da logolar bulanıklaşmaz.",
    group: "Temel bilgiler",
    body: `Bir resmi bilgisayarda saklamanın temelde birbirinden farklı iki yolu vardır.

## Raster görüntüler

Raster görüntü, piksel adı verilen küçük renkli karelerden oluşan bir ızgaradır. Bir telefonla çekilmiş fotoğraf 4.000 piksel genişliğinde ve 3.000 piksel yüksekliğinde olabilir; bu da her birinin kendi rengi olan on iki milyon piksel demektir. JPEG, PNG, WebP, AVIF, HEIC ve GIF'in hepsi raster biçimlerdir.

Raster görüntüler, her pikselin biraz farklı olabildiği fotoğraflar için idealdir. Sınırları, piksel sayısının sabit olmasıdır. Bir raster görüntüyü küçültmek pikselleri atar. Büyütmek ise hiç var olmamış pikselleri uydurmak anlamına gelir; ekranı dolduracak şekilde gerilen küçük bir görüntünün yumuşak ya da bloklu görünmesinin nedeni budur. Hiçbir yazılım, yakalanmamış ayrıntıyı geri getiremez.

## Vektör görüntüler

Vektör görüntü piksel saklamaz. Talimatlar saklar: buraya bir daire çiz, bu noktadan şu noktaya bir eğri çiz, bu şekli turuncuyla doldur. SVG, web'deki en yaygın vektör biçimidir. Şekiller matematiksel olarak tanımlandığı için bir vektör görüntü her boyutta çizilebilir ve kusursuz biçimde keskin kalır.

Vektörler logolar, simgeler, diyagramlar ve metin için uygundur. Fotoğraflar için uygun değildir, çünkü bir fotoğrafta tanımlanacak net şekiller yoktur.

## Universal Images bunları nasıl ele alır

Universal Images raster görüntülerle çalışır. Bir SVG eklediğinizde uygulama, onu diğer resimler gibi kırpılabilir, yeniden boyutlandırılabilir ve dönüştürülebilir hale getirmek için bir kez piksellere çizer. Sonuç bir raster görüntüdür; bu nedenle dışa aktarmadan önce ihtiyacınız olan boyutu seçin. Bir logoya birkaç farklı boyutta ihtiyacınız varsa küçük bir dışa aktarımı büyütmek yerine orijinal SVG'yi saklayın ve her boyutu ondan dışa aktarın.

## Yararlı bir kural

- Görüntüleri gönül rahatlığıyla küçültün. Bir raster görüntüyü küçültmek genellikle iyi sonuç verir.
- Raster görüntüleri orijinal boyutlarından daha büyük yapmaktan kaçının. Uygulama bunu yapabilir, ancak gerçek ayrıntı ekleyemez.
- Vektör bir orijinaliniz varsa onu saklayın. Ana kopya odur.`,
  },
  {
    id: 'image-formats',
    title: "JPEG, PNG, WebP, AVIF ve HEIC: hangisini kullanmalı?",
    summary: "Her biçimin neyde iyi olduğu ve kaydederken hangisinin seçileceği.",
    group: "Temel bilgiler",
    body: `Görüntü biçimleri, pikselleri bir dosyaya paketlemenin farklı yollarıdır. Her biri dosya boyutu, kalite, saydamlık ve ne kadar yaygın desteklendiği arasında farklı ödünleşimler yapar.

## Biçimler

- **JPEG**, fotoğraflar için klasik biçimdir. Gözün fark etmesi olası olmayan ayrıntıları atarak dosyaları küçük tutan kayıplı sıkıştırma kullanır. Saydamlığı desteklemez. Hemen her şey bir JPEG'i açabilir.
- **PNG** kayıpsız sıkıştırma kullanır; bu nedenle her piksel tam olarak korunur. Saydamlığı destekler. Ekran görüntüleri, keskin kenarlı grafikler ve metin ile dekupe görüntüler için idealdir. PNG olarak kaydedilen fotoğraflar genellikle aynı fotoğrafın JPEG haline göre çok daha büyüktür.
- **WebP**, web için tasarlanmış daha yeni bir biçimdir. Kayıplı ya da kayıpsız olabilir ve saydamlığı destekler. Fotoğraflar için genellikle benzer kalitedeki bir JPEG'den daha küçüktür. Güncel büyük tarayıcıların tümü onu destekler, ancak bazı eski yazılımlar desteklemez.
- **AVIF** daha da yenidir ve benzer kalitede çoğu zaman WebP'den daha küçük dosyalar üretir. Desteği artmaktadır ancak o kadar evrensel değildir ve her tarayıcı AVIF dosyası oluşturamaz.
- **HEIC**, birçok iPhone'un fotoğraflar için kullandığı biçimdir. Verimlidir, ancak birçok web sitesi ve Windows programı onu açamaz.
- **GIF**, 256 renkle sınırlı eski bir biçimdir ve en çok kısa animasyonlarla bilinir.

## Universal Images neleri açabilir ve kaydedebilir

Uygulama JPEG, PNG, WebP, AVIF, HEIC, GIF ve SVG dosyalarını açar. JPEG, PNG, WebP ya da AVIF olarak kaydeder. AVIF yalnızca kullandığınız cihaz bu biçimi oluşturabiliyorsa sunulur.

HEIC fotoğraflar, uygulamanın geri kalanının onlarla çalışabilmesi için açılırken yüksek kaliteli bir JPEG'e dönüştürülür. Animasyonlu bir GIF tek bir durağan görüntüye dönüşür.

## Hangisini seçmelisiniz?

- **Bir fotoğrafı herkesle, her yerde paylaşmak:** JPEG.
- **Kendi web siteniz için bir fotoğraf:** WebP ya da siteniz destekliyorsa AVIF.
- **Bir logo, ekran görüntüsü ya da metin içeren herhangi bir şey:** PNG.
- **Saydam arka planlı bir dekupe görüntü:** PNG ya da WebP. JPEG saydamlık saklayamaz.
- **Birinin açamadığı bir iPhone fotoğrafı:** JPEG'e dönüştürün.

Uygulama, siz biçimi ve kaliteyi değiştirdikçe tahmini dosya boyutunu gösterir; bu yüzden iki üç seçeneği deneyip karşılaştırmaya değer.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: "Pikseller, çözünürlük ve DPI",
    summary: "Görüntü boyutunun ekranda ve kâğıtta gerçekte ne anlama geldiği.",
    group: "Temel bilgiler",
    body: `İnsanlar çözünürlük kelimesini birkaç farklı anlamda kullanır ve bu da epey kafa karışıklığına yol açar. Gerçekten önemli olan şudur.

## Önemli olan piksel boyutlarıdır

Dijital bir görüntüyle ilgili en önemli bilgi piksel boyutlarıdır: kaç piksel genişliğinde ve kaç piksel yüksekliğinde olduğu, örneğin 1920'ye 1080. Bu sayı, görüntünün ne kadar ayrıntı taşıdığını söyler. Universal Images piksel boyutlarını gösterir ve bu boyutlarla çalışır.

## DPI yalnızca baskı için bir talimattır

DPI ya da PPI, inç başına nokta ya da piksel anlamına gelir. Bazı görüntü dosyalarında saklanan ve yazıcıya pikselleri ne büyüklükte basacağını söyleyen bir nottur. Piksellerin kendisini değiştirmez. 3.000'e 2.000 piksellik bir görüntü, dosyasında 72 DPI da yazsa 300 DPI da yazsa tam olarak aynı ayrıntıyı taşır. Tek fark, kâğıda ne büyüklükte basıldığıdır.

Ekranda DPI ayarı yok sayılır. Ekran yalnızca pikselleri gösterir.

## İhtiyacınız olan boyutu hesaplamak

Baskı için yaygın bir yönerge, yakından bakılan fotoğraflar için inç başına yaklaşık 300 piksel, afişler gibi uzaktan bakılan şeyler için ise daha azdır. İhtiyacınız olan pikselleri hesaplamak için inç cinsinden baskı boyutunu inç başına piksel sayısıyla çarpın. Bir inç 2,54 cm'dir.

1. İnç başına 300 pikselde 6'ya 4 inçlik bir fotoğraf 1800'e 1200 piksel gerektirir.
2. Bir A4 sayfa yaklaşık 8,3'e 11,7 inçtir; dolayısıyla inç başına 300 pikselde kabaca 2480'e 3508 piksel gerektirir.

Ekranlar ve web için görüntünün dolduracağı alanı düşünün. Bir web sayfasında 800 piksel genişliğinde gösterilen bir resmin, yüksek yoğunluklu ekranlarda keskin kalması için nadiren bunun yaklaşık iki katından fazlasına ihtiyacı olur. Daha büyük olan her şey yalnızca sayfanın daha yavaş yüklenmesine neden olur.

## En boy oranı

En boy oranı görüntünün şeklidir: genişliğin yüksekliğe oranı, örneğin 16:9 ya da 1:1. Genişliği ve yüksekliği farklı miktarlarda değiştirirseniz görüntü basık ya da gerilmiş görünür. Universal Images siz aksini seçmedikçe oranı kilitli tutar ve sosyal medya ön ayarları resmi bozmak yerine her platformun şekline göre kırpar.`,
  },
  {
    id: 'what-compression-does',
    title: "Sıkıştırma aslında ne yapar?",
    summary: "Kayıplı ve kayıpsız sıkıştırma ve kalite kaydırıcısının neyi değiştirdiği.",
    group: "Temel bilgiler",
    body: `Sıkıştırılmamış bir fotoğraf devasadır. Her biri rengi için birkaç bayt gerektiren on iki milyon piksel, onlarca megabayta ulaşır. Sıkıştırma, görüntü biçimlerinin bunu yönetilebilir hale getirme yoludur.

## Kayıpsız sıkıştırma

Kayıpsız sıkıştırma, örüntüleri ve tekrarları bulur ve bunları daha verimli biçimde yazar; biraz her pikseli tek tek listelemek yerine "100 mavi piksel" yazmak gibi. Görüntü açıldığında her piksel tam olarak eski haliyle geri gelir. PNG kayıpsızdır. Geniş düz renk alanları olan grafiklerde çok iyi, komşu piksellerin nadiren aynı olduğu fotoğraflarda ise çok daha az iyi çalışır.

## Kayıplı sıkıştırma

Kayıplı sıkıştırma, renk ya da dokudaki çok ince farklılıklar gibi insanların fark etmesi olası olmayan bilgileri atarak daha da ileri gider. JPEG ile olağan modlarındaki WebP ve AVIF kayıplıdır. Sonuç, gözle görülür fark az olmak üzere orijinalden kat kat küçük bir dosya olabilir. Atılan bilgi kalıcı olarak kaybolur.

## Kalite kaydırıcısı

JPEG, WebP ya da AVIF olarak kaydederken kalite kaydırıcısı, kodlayıcının ne kadarını atmasına izin verildiğini denetler. Daha yüksek kalite, daha fazla ayrıntının korunduğu daha büyük bir dosya demektir. Daha düşük kalite ise daha küçük bir dosya ve sonunda gözle görülür sorunlar demektir:

- gökyüzü gibi düzgün alanlarda bloklu kareler
- saç ya da çimen gibi ince ayrıntılarda bulaşmış görünüm
- keskin kenarların ve metnin çevresinde hafif dalgalanmalar

İlişki eşit değildir. Ölçeğin en üstünden biraz aşağı inmek çoğu zaman gözle görülür bir değişiklik olmadan çok yer kazandırır; en alta yakın yerlerde düşürmek ise az yer kazandırır ve çok daha kötü görünür. PNG kayıpsızdır, bu nedenle kalite ayarı yoktur.

## Pratik ipuçları

- **Önce yeniden boyutlandırın.** Piksel boyutlarını gerçekten ihtiyacınız olana indirmek genellikle kaliteyi düşürmekten çok daha fazla yer kazandırır.
- **Tahmini izleyin.** Universal Images siz kaydırıcıyı hareket ettirdikçe beklenen dosya boyutunu günceller. Önizlemeye bakın, ardından memnun kaldığınız en düşük ayarı bulun.
- **Tekrar tekrar kaydetmekten kaçının.** Her kayıplı kayıt biraz daha fazlasını atar. Başka değişiklikler yapmanız gerekiyorsa zaten sıkıştırılmış bir kopyayı yeniden düzenlemek yerine orijinale geri dönün.`,
  },
  {
    id: 'how-universal-images-works',
    title: "Universal Images nasıl çalışır",
    summary: "İşin nerede yapıldığı, yapay zekâ araçlarının ne yaptığı ve sınırları.",
    group: "Nasıl çalışır",
    body: `Universal Images tüm görüntü işlemlerini kendi cihazınızda yapar. Bir işleme sunucusu yoktur. Bir resim eklediğinizde uygulama dosyayı okur ve bundan sonraki her adım uygulamanın kendi içinde gerçekleşir.

## Yeniden boyutlandırma ve dönüştürme

Uygulama görüntünüzü seçtiğiniz boyutta dahili bir tuval üzerine çizer, ardından seçtiğiniz biçim ve kalitede kaydeder. Bir görüntüyü çok küçültürken bunu tek seferde değil, birkaç yarıya indirme adımında yapar; bu da tek bir büyük küçültmenin üretebileceği tırtıklı, titreşen kenarları önler.

Kırpma da aynı şekilde çalışır: yeni görüntüye yalnızca kırpma alanının içindeki kısım çizilir. Sosyal medya ön ayarları resmi her platformun şekline uyacak şekilde kırpar ve boyutlandırır; çerçevede neyin kalacağını sürükleyerek seçebilirsiniz.

Toplu dışa aktarma, seçtiğiniz biçim ve boyut ayarlarını eklediğiniz her görüntüye uygular ve hepsini tek bir ZIP dosyası olarak birlikte indirir.

## Arka plan kaldırma

Arka planı kaldır, konuyu arka planından ayıran bir yapay zekâ modeli kullanır. Model cihazınızda çalışır. İlk kullanışınızda uygulamanın modeli indirmesi gerekebilir; model büyüktür ve sonraki kullanımlar daha hızlı olsun diye cihazınızda saklanır. Bu indirme, herkes için aynı olan modelin kendisidir; resminiz hiçbir yere gönderilmez.

En iyi sonucu, belirgin bir arka plan önündeki net bir konuda verir. İnce saçlar, cam ve kalabalık sahneler onu şaşırtabilir; bu yüzden sonucu kullanmadan önce kenarları kontrol edin.

## Yüzleri bulanıklaştırma

Yüzleri bulanıklaştır, yüzleri bulmak ve ardından bulanıklaştırmak ya da pikselleştirmek için yine cihazınızda çalışan küçük bir yüz algılama modeli kullanır. Tek tek yüzleri açıp kapatabilir ve gücü değiştirebilirsiniz.

Otomatik algılama bir yardımdır, bir garanti değildir. Küçük, uzakta, başka yöne dönük ya da kısmen gizlenmiş yüzleri kaçırabilir. Paylaşmadan önce sonucu her zaman gözden geçirin ve güçlü bir ayar kullanın: hafif bir bulanıklık ya da büyük, yumuşak pikseller bir yüzü tanınabilir bırakabilir.

## Kutularla örtme

Karartma, resmin üzerine düz renkli kutular çizer: bir şeyi örtmek için sürükleyin ya da bir kutu bırakmak için dokunun, sonra kutuyu taşıyın veya boyutunu değiştirin. Bir isim, plaka, ekran ya da algılamanın kaçırdığı bir yüz için kullanabilirsiniz. Rengi "Redact areas" bölümünden seçin.

Düzenlerken kutular üstte durur ve hâlâ taşınabilir; orijinaliniz değişmez. İndirdiğiniz, çevrimiçi yedeklediğiniz ya da kolaja koyduğunuz resimde kutular piksellere işlenmiştir, bu yüzden altlarında kalan hiçbir şey o dosyadan geri getirilemez. Universal Images yedek dosyası farklıdır: orijinali, kutular hâlâ taşınabilir hâlde saklar; bu yüzden yalnızca indirilen resmi paylaşın.

## Kolajlar

Kolaj aracı birkaç fotoğrafı yan yana, üst üste ya da bir ızgara içinde düzenler; aralık, köşeler ve arka plan ayarlanabilir. Kolajı indirebilir ya da yeniden boyutlandırmak veya dönüştürmek için görüntülerinize geri ekleyebilirsiniz.

## Çevrimdışı çalışma

Yeniden boyutlandırma, kırpma, dönüştürme ve meta verileri okuma hiç bağlantı olmadan çalışır. Arka plan kaldırma ve yüz bulanıklaştırma yalnızca modellerinin ilk indirilmesi için bağlantıya ihtiyaç duyar.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: "Fotoğraf meta verileri ve konum verileri",
    summary: "Bir fotoğrafın nerede ve ne zaman çekildiği hakkında neleri açığa çıkarabileceği ve bunların nasıl kaldırılacağı.",
    group: "Gizlilik ve güvenlik",
    body: `Çoğu fotoğraf, resmin kendisinden fazlasını taşır. Kameralar ve telefonlar dosyaya meta veri adı verilen ek bilgiler yazar. En yaygın türü EXIF olarak bilinir. Şunları içerebilir:

- fotoğrafın çekildiği tarih ve saat
- kameranın ya da telefonun markası ve modeli, bazen bir seri numarası
- pozlama ve odak uzaklığı gibi kamera ayarları
- düzenlemek için kullanılan yazılım ve bazen bir yazar ya da sahip adı
- fotoğrafın nerede çekildiğini gösteren, çoğu zaman birkaç metreye kadar doğru **GPS koordinatları**
- ana görüntü kırpıldıktan ya da düzenlendikten sonra bile orijinal resmi gösterebilen küçük bir önizleme küçük resmi

Bunların büyük kısmı, bir fotoğraf e-postayla ya da dosya olarak gönderildiğinde korunur. Bazı web siteleri ve uygulamalar yükleme sırasında bunları kaldırır, ancak birçoğu kaldırmaz ve hangisinin kaldırdığını her zaman bilemezsiniz.

## Bir fotoğrafın neler içerdiğini görmek

Universal Images bir fotoğrafın meta verilerini size gösterebilir ve bir kişiye, bir yere ya da bir cihaza işaret eden kısımları vurgular. Fotoğrafta GPS koordinatları varsa uygulama, ülkeyi ve fotoğrafın o ülkenin neresinde çekildiğini gösteren küçük bir harita çizer.

Bu harita uygulamayla birlikte gelen ülke sınırlarından çizilir; bu nedenle haritayı göstermek fotoğrafın nerede çekildiğini kimseye söylemez. Daha fazla ayrıntı istiyorsanız il ve en yakın kasabaya yakınlaştırmak için bir düğme vardır. Bu düğmeye basmak o tek ülke için bir sınır dosyası yükler. Uygulamanın web sürümünde bu, dosyanın Universal Images web sitesinden indirilmesi anlamına gelir. İstek ülkenin adını içerir ancak hiçbir koordinat taşımaz ve yalnızca düğmeye bastığınızda gerçekleşir. Uygulama hiçbir zaman bir sokak adresi aramaz.

## Meta verileri kaldırmak

Temiz bir kopya elde etmenin iki yolu vardır:

- Meta veri panelindeki **Meta verileri temizle**, resmi yeniden sıkıştırmadan JPEG, PNG ve WebP dosyalarındaki meta verileri kaldırır; böylece görüntü kalitesine dokunulmaz. Resmin doğru görüntülenmesi için gereken renk bilgileri korunur.
- Uygulamadan yapılan **her dışa aktarma** yeni oluşturulmuş bir görüntüdür. Uygulama üzerinden yeniden boyutlandırma, dönüştürme, kırpma ya da yalnızca indirme, konumu dahil orijinalin EXIF verilerini taşımayan bir dosya üretir.

Bilmeniz gereken bir istisna var: Masaüstüne kaydet yedeği, daha sonra düzenlemeye devam edebilmeniz için orijinal görüntünüzü bilerek saklar. Orijinalde konum verisi varsa yedekte de vardır. Bu sizin için önemliyse önce meta verileri temizleyin.`,
  },
  {
    id: 'what-leaves-your-device',
    title: "Cihazınızdan neler çıkar",
    summary: "Tam olarak neyin cihazınızda kaldığı ve çevrimiçi giden birkaç şey.",
    group: "Gizlilik ve güvenlik",
    body: `Universal Images, resimleriniz sizinle kalacak şekilde tasarlanmıştır. Tam olarak şunlar olur.

## Cihazınızda kalır

- **Görüntüleriniz.** Açma, kırpma, yeniden boyutlandırma, dönüştürme, meta verileri temizleme, kolaj yapma, arka planları kaldırma ve yüzleri bulanıklaştırma işlemlerinin tümü cihazınızda gerçekleşir. Resimleriniz işlenmek üzere yüklenmez.
- **İndirmeler ve yedekler.** İndir, sonucu cihazınıza kaydeder. Masaüstüne kaydet, kendinizin sakladığı bir yedek dosyası oluşturur.

## Yükleme olmayan indirmeler

Arka plan kaldırmayı ya da yüz bulanıklaştırmayı ilk kez kullandığınızda uygulamanın, ihtiyaç duyduğu yapay zekâ modelini bir içerik dağıtım ağından indirmesi gerekebilir. Model, herkes için aynı olan sabit bir dosyadır. Bu sunucular, her indirmede olduğu gibi bağlantınızdan gelen sıradan bir istek görür, ancak görüntünüzü almaz. Resim, cihazınızdaki model tarafından işlenir.

Konum haritasını il düzeyine yakınlaştırırsanız uygulamanın web sürümü Universal Images web sitesinden bir ülkenin sınır dosyasını indirir. Bu istek fotoğrafın koordinatlarını değil, ülkenin adını içerir.

## Yalnızca siz seçtiğinizde: çevrimiçi saklama

Universal ID'nizle oturum açar ve bir görüntüyü UNI·SIM'de saklamayı seçerseniz uygulama, başka bir cihazda geri alabilmeniz için bitmiş görüntüyü, yani İndir düğmesinin size vereceği görüntünün aynısını yükler. Görüntüleri çevrimiçi saklamak Universal ID ile ücretsizdir. Ücretsiz hesapların cömert bir sınırı vardır; bu sınıra bir gün ulaşırsanız artık ihtiyacınız olmayan bir görüntüyü silin. Bir görüntüyü silmek onu depolamadan kaldırır.

Bu, uçtan uca şifreleme değil sıradan bir bulut depolamadır. Aktarım sırasında ve depolandığı yerde şifrelenir ve erişim hesabınızla sınırlıdır, ancak anahtarlar bizdedir. Belirli bir resim için bu önemliyse onu saklamayın; uygulama hesap olmadan da tam olarak çalışır.

## Her Universal uygulamasının gönderdikleri

Uygulama açıkken, menünün onu kaç kişinin kullandığını gösterebilmesi için sunucumuza kullanımda olduğunu belirten küçük bir sinyal gönderir. Bu sinyal uygulamanın adını, cihaz türünü (web, telefon ya da masaüstü), bu cihazda oluşturulan rastgele bir kimliği ve oturum açtıysanız hesabınızı içerir. Oturum açtıysanız uygulama, hesabınızın etkinlik sayfası için uygulamayı açtığınızı da kaydeder. Bunların hiçbiri görüntülerinizle ilgili bir şey içermez: ne adlarını, ne boyutlarını ne de içeriklerini.

Uygulamada üçüncü taraf analiz, izleme ya da reklam yoktur.`,
  },
]

export default articles
