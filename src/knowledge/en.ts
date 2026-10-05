import type { Article } from './types'

const articles: Article[] = [
  {
    id: 'raster-and-vector',
    title: 'Raster and vector images',
    summary: 'Why photos go blurry when enlarged, and logos do not.',
    group: 'The basics',
    body: `There are two fundamentally different ways of storing a picture on a computer.

## Raster images

A raster image is a grid of tiny coloured squares called pixels. A photo from a phone might be 4,000 pixels wide and 3,000 tall, which is twelve million pixels, each with its own colour. JPEG, PNG, WebP, AVIF, HEIC and GIF are all raster formats.

Raster images are ideal for photographs, where every pixel can be slightly different. Their limit is that the number of pixels is fixed. Shrinking a raster image throws pixels away. Enlarging it means inventing pixels that were never there, which is why a small image stretched to fill a screen looks soft or blocky. No software can recover detail that was not captured.

## Vector images

A vector image does not store pixels. It stores instructions: draw a circle here, a curve from this point to that one, fill this shape with orange. SVG is the most common vector format on the web. Because the shapes are described mathematically, a vector image can be drawn at any size and stays perfectly sharp.

Vectors suit logos, icons, diagrams and text. They are not suited to photographs, because a photo has no clean shapes to describe.

## How Universal Images handles them

Universal Images works on raster images. When you add an SVG, the app draws it once into pixels so it can be cropped, resized and converted like any other picture. The result is a raster image, so choose the size you need before you export. If you need a logo at several sizes, keep the original SVG and export each size from it, rather than enlarging a small export.

## A useful rule

- Make things smaller freely. Downscaling a raster image usually looks good.
- Avoid making raster images bigger than their original size. The app can do it, but it cannot add real detail.
- If you have a vector original, keep it. It is the master copy.`,
  },
  {
    id: 'image-formats',
    title: 'JPEG, PNG, WebP, AVIF and HEIC: which to use?',
    summary: 'What each format is good at, and which one to pick when saving.',
    group: 'The basics',
    body: `Image formats are different ways of packing pixels into a file. Each makes different trade-offs between file size, quality, transparency and how widely it is supported.

## The formats

- **JPEG** is the classic format for photos. It uses lossy compression, which keeps files small by discarding detail the eye is unlikely to notice. It does not support transparency. Almost everything can open a JPEG.
- **PNG** uses lossless compression, so every pixel is kept exactly. It supports transparency. It is ideal for screenshots, graphics with sharp edges and text, and cut-outs. Photos saved as PNG are usually much larger than the same photo as a JPEG.
- **WebP** is a newer format designed for the web. It can be lossy or lossless and supports transparency. For photos it is typically smaller than a JPEG of similar quality. All current major browsers support it, though some older software does not.
- **AVIF** is newer still and often produces smaller files than WebP at similar quality. Support is growing but less universal, and not every browser can create AVIF files.
- **HEIC** is the format many iPhones use for photos. It is efficient, but many websites and Windows programs cannot open it.
- **GIF** is an old format limited to 256 colours, best known for short animations.

## What Universal Images can open and save

The app opens JPEG, PNG, WebP, AVIF, HEIC, GIF and SVG. It saves as JPEG, PNG, WebP or AVIF. AVIF is offered only when the device you are using can create it.

HEIC photos are converted to a high-quality JPEG as they are opened, so the rest of the app can work with them. An animated GIF becomes a single still image.

## Which should you choose?

- **Sharing a photo with anyone, anywhere:** JPEG.
- **A photo for your own website:** WebP, or AVIF if your site supports it.
- **A logo, screenshot or anything with text:** PNG.
- **A cut-out with a transparent background:** PNG or WebP. JPEG cannot store transparency.
- **An iPhone photo someone cannot open:** convert it to JPEG.

The app shows an estimate of the file size as you change format and quality, so it is worth trying two or three options and comparing.`,
  },
  {
    id: 'pixels-resolution-dpi',
    title: 'Pixels, resolution and DPI',
    summary: 'What image size really means on a screen and on paper.',
    group: 'The basics',
    body: `People use the word resolution to mean several different things, which causes a lot of confusion. Here is what actually matters.

## Pixel dimensions are what count

The most important fact about a digital image is its pixel dimensions: how many pixels wide and how many tall, for example 1920 by 1080. That number tells you how much detail the image holds. Universal Images shows and works in pixel dimensions.

## DPI is only an instruction for printing

DPI, or PPI, means dots or pixels per inch. It is a note stored in some image files that tells a printer how large to print the pixels. It does not change the pixels themselves. An image of 3,000 by 2,000 pixels holds exactly the same detail whether its file says 72 DPI or 300 DPI. The only difference is how big it comes out on paper.

On a screen, the DPI setting is ignored. A screen simply shows pixels.

## Working out the size you need

For print, a common guideline is around 300 pixels per inch for photos viewed up close, and less for things viewed from a distance, such as posters. To work out the pixels you need, multiply the print size in inches by the pixels per inch. One inch is 2.54 cm.

1. A 6 by 4 inch photo at 300 pixels per inch needs 1800 by 1200 pixels.
2. An A4 page is about 8.3 by 11.7 inches, so at 300 pixels per inch it needs roughly 2480 by 3508 pixels.

For screens and the web, think about the space the image will fill. A picture shown 800 pixels wide on a web page rarely needs to be more than about twice that, to stay sharp on high-density screens. Anything larger just makes the page slower to load.

## Aspect ratio

Aspect ratio is the shape of the image: the width compared with the height, such as 16:9 or 1:1. If you change the width and height by different amounts, the image is squashed or stretched. Universal Images keeps the ratio locked unless you choose otherwise, and its social media presets crop to each platform's shape rather than distorting the picture.`,
  },
  {
    id: 'what-compression-does',
    title: 'What does compression actually do?',
    summary: 'Lossy and lossless compression, and what the quality slider changes.',
    group: 'The basics',
    body: `An uncompressed photo is enormous. Twelve million pixels, each needing several bytes for its colour, adds up to tens of megabytes. Compression is how image formats make that manageable.

## Lossless compression

Lossless compression finds patterns and repetition and writes them more efficiently, a little like writing "100 blue pixels" instead of listing each one. When the image is opened, every pixel comes back exactly as it was. PNG is lossless. It works very well on graphics with large areas of flat colour and much less well on photos, where neighbouring pixels are rarely identical.

## Lossy compression

Lossy compression goes further by throwing away information that people are unlikely to notice, such as very fine variations in colour or texture. JPEG, and WebP and AVIF in their usual modes, are lossy. The result can be a file many times smaller than the original with little visible difference. The information discarded is gone for good.

## The quality slider

When you save as JPEG, WebP or AVIF, the quality slider controls how much the encoder is allowed to discard. Higher quality means a larger file with more detail kept. Lower quality means a smaller file and, eventually, visible problems:

- blocky squares in smooth areas such as skies
- smudged fine detail, such as hair or grass
- faint ripples around sharp edges and text

The relationship is not even. Dropping from the very top of the scale often saves a lot of space with no visible change, while dropping near the bottom saves little and looks much worse. PNG is lossless, so it has no quality setting.

## Practical tips

- **Resize first.** Reducing the pixel dimensions to what you actually need usually saves far more than lowering the quality.
- **Watch the estimate.** Universal Images updates the expected file size as you move the slider. Look at the preview, then find the lowest setting you are happy with.
- **Avoid saving again and again.** Each lossy save discards a little more. If you need to make further changes, go back to the original rather than re-editing an already compressed copy.`,
  },
  {
    id: 'how-universal-images-works',
    title: 'How Universal Images works',
    summary: 'Where the work happens, what the AI tools do, and their limits.',
    group: 'How it works',
    body: `Universal Images does all of its image work on your own device. There is no processing server. When you add a picture, the app reads the file and every step after that happens in the app itself.

## Resizing and converting

The app draws your image onto an internal canvas at the size you choose, then saves it in the format and quality you pick. When it shrinks an image by a lot, it does so in several halving steps rather than all at once, which avoids the jagged, shimmering edges a single large reduction can produce.

Cropping works the same way: only the part inside the crop is drawn into the new image. The social media presets crop and size the picture to match each platform's shape, and you can drag to choose what stays in the frame.

Batch export applies your chosen format and size settings to every image you have added and downloads them together as one ZIP file.

## Background removal

Remove background uses an AI model that separates the subject from its background. The model runs on your device. The first time you use it, the app may need to download the model, which is large and is then kept by your device so later uses are quicker. That download is the model itself, the same for everyone; your picture is not sent anywhere.

It works best on a clear subject against a distinct background. Fine hair, glass and busy scenes can confuse it, so check the edges before you use the result.

## Blurring faces

Blur faces uses a small face-detection model, also running on your device, to find faces and then blur or pixelate them. You can switch individual faces on or off and change the strength.

Automatic detection is a help, not a guarantee. It can miss faces that are small, distant, turned away or partly hidden. Always look over the result before sharing, and use a strong setting: a light blur or large, soft pixels can leave a face recognisable.

## Covering things with boxes

Redact draws solid boxes over the picture: drag to cover something, or tap to drop a box and then move or resize it. Use it for a name, a number plate, a screen, or a face the detector missed. Pick the box colour in the Redact areas section.

While you edit, the boxes sit on top and can still be moved; your original is not changed. The picture you download, back up online or put in a collage has them painted into its pixels, so nothing under a box can be recovered from that file. A Universal Images backup file is different: it keeps the original with the boxes still movable, so only share the downloaded picture.

## Collages

The collage tool arranges several photos side by side, stacked or in a grid, with adjustable spacing, corners and background. You can download the collage or add it back to your images to resize or convert it.

## Working offline

Resizing, cropping, converting and reading metadata work with no connection at all. Background removal and face blurring need a connection only for the first download of their models.`,
  },
  {
    id: 'photo-metadata-and-location',
    title: 'Photo metadata and location data',
    summary: 'What a photo can reveal about where and when it was taken, and how to remove it.',
    group: 'Privacy and security',
    body: `Most photos carry more than the picture. Cameras and phones write extra information, called metadata, into the file. The most common kind is known as EXIF. It can include:

- the date and time the photo was taken
- the make and model of the camera or phone, sometimes a serial number
- camera settings such as exposure and focal length
- the software used to edit it, and sometimes an author or owner name
- **GPS coordinates** showing where the photo was taken, often accurate to a few metres
- a small preview thumbnail, which can still show the original picture after the main image has been cropped or edited

Much of this survives when a photo is emailed or sent as a file. Some websites and apps remove it when you upload, but many do not, and you cannot always tell which.

## Seeing what a photo contains

Universal Images can show you a photo's metadata, highlighting the parts that point to a person, a place or a device. If the photo has GPS coordinates, the app draws a small map showing the country and where in it the photo was taken.

That map is drawn from country outlines that come with the app, so showing it does not tell anyone where the photo was taken. If you want more detail, there is a button to zoom in to the county and nearest town. Pressing it loads a boundary file for that one country. In the web version of the app, that means downloading it from the Universal Images website. The request names the country but carries no coordinates, and it only happens when you press the button. The app never looks up a street address.

## Removing metadata

There are two ways to get a clean copy:

- **Strip metadata** in the metadata panel removes the metadata from JPEG, PNG and WebP files without re-compressing the picture, so the image quality is untouched. Colour information needed to display the picture correctly is kept.
- **Any export** from the app is a newly created image. Resizing, converting, cropping or simply downloading through the app produces a file that does not carry the original's EXIF data, including its location.

One exception to know about: the Save to desktop backup deliberately keeps your original image so you can carry on editing later. If the original had location data, so does the backup. Strip the metadata first if that matters.`,
  },
  {
    id: 'what-leaves-your-device',
    title: 'What leaves your device',
    summary: 'Exactly what stays on your device, and the few things that go online.',
    group: 'Privacy and security',
    body: `Universal Images is built so that your pictures stay with you. Here is exactly what happens.

## Stays on your device

- **Your images.** Opening, cropping, resizing, converting, stripping metadata, making collages, removing backgrounds and blurring faces all happen on your device. Your pictures are not uploaded to be processed.
- **Downloads and backups.** Download saves the result to your device. Save to desktop creates a backup file that you keep yourself.

## Downloads that are not uploads

The first time you use background removal or face blurring, the app may download the AI model it needs from a content delivery network. The model is a fixed file, the same for everyone. Those servers see an ordinary request from your connection, as with any download, but they do not receive your image. The picture is processed by the model on your device.

If you zoom the location map in to county level, the web version of the app downloads one country's boundary file from the Universal Images website. That request names the country, not the photo's coordinates.

## Only when you choose: storing online

If you sign in with your Universal ID and choose to store an image with UNI·SIM, the app uploads the finished image, the same one the Download button would give you, so you can get it back on another device. Storing images online is free with a Universal ID. Free accounts have a generous limit; if you ever reach it, delete an image you no longer need. Deleting an image removes it from storage.

This is ordinary cloud storage, not end-to-end encryption. It is encrypted in transit and at rest and access is limited to your account, but we hold the keys. If that matters for a particular picture, do not store it; the app works fully without an account.

## What every Universal app sends

While the app is open, it sends our server a small signal that it is in use, so the menu can show how many people use it. That signal holds the app's name, the kind of device (web, phone or desktop), a random ID created on this device and, if you are signed in, your account. If you are signed in, the app also records that you opened it, for your account's activity page. Neither includes anything about your images: not their names, sizes or contents.

There is no third-party analytics, tracking or advertising in the app.`,
  },
]

export default articles
