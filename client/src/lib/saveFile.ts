import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Enregistrer un fichier généré dans l'app (story, export .ics…).
// - Site : téléchargement classique du navigateur.
// - Apps Android / iPhone : la WebView ignore les téléchargements ; le fichier est écrit dans
//   le cache de l'app puis proposé dans le menu de partage du téléphone (Instagram, WhatsApp,
//   Photos / Galerie, Agenda…).
export async function saveFile(blob: Blob, filename: string, title?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title: title ?? filename, files: [uri] });
  } catch (e) {
    // Menu de partage fermé sans choisir d'application : pas une erreur
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Enregistrer une image (story d'un Plan) dans les photos du téléphone : album « EvLY » de la
// galerie sur Android, Photos sur iPhone (autorisation « ajout seulement »). Sur le site :
// téléchargement classique. dataUrl = image encodée (data:image/jpeg;base64,…).
export async function saveImage(dataUrl: string, filename: string): Promise<'gallery' | 'download'> {
  if (!Capacitor.isNativePlatform()) {
    await saveFile(await (await fetch(dataUrl)).blob(), filename);
    return 'download';
  }
  const { Media } = await import('@capacitor-community/media');
  const name = filename.replace(/\.[a-z0-9]+$/i, '');
  if (Capacitor.getPlatform() === 'android') {
    // Android : un album est obligatoire ; on utilise (ou crée) l'album « EvLY » de l'app
    const { path } = await Media.getAlbumsPath();
    const find = async () => (await Media.getAlbums()).albums.find(a => a.name === 'EvLY' && a.identifier.startsWith(path));
    let album = await find();
    if (!album) {
      await Media.createAlbum({ name: 'EvLY' });
      album = await find();
    }
    await Media.savePhoto({ path: dataUrl, albumIdentifier: album?.identifier, fileName: name });
  } else {
    await Media.savePhoto({ path: dataUrl, fileName: name });
  }
  return 'gallery';
}
