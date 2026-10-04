// Validate the JPEG frame before allocating a browser image or accepting backup media.
export function validateJpegBytes(bytes) {
  const invalid=()=>{throw new Error('バックアップの写真の形式が正しくありません。');};
  if (!(bytes instanceof Uint8Array) || bytes.length>1048576 || bytes.length<20 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217) invalid();
  let offset=2,frame=null,scan=false;
  while (offset<bytes.length-2) {
    if (bytes[offset++]!==255) invalid();
    while (bytes[offset]===255) offset++;
    const marker=bytes[offset++];
    if (marker===217) break;
    if (marker===0 || marker===216 || marker===1 || (marker>=208&&marker<=215)) invalid();
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if (length<2 || offset+length>bytes.length-2) invalid();
    if ([192,193,194].includes(marker)) {
      if (length<8) invalid();
      const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];
      if (!width || !height || Math.max(width,height)>1600) invalid();
      frame={width,height};
    }
    if (marker===218) {scan=true;break;}
    offset+=length;
  }
  if (!frame || !scan) invalid();return frame;
}

export async function verifyPhotoBlob(blob) {
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const dimensions=validateJpegBytes(bytes);
  if (typeof Image!=='undefined') {
    const url=URL.createObjectURL(blob);
    try {
      const image=new Image();image.src=url;await image.decode();
      if (image.naturalWidth!==dimensions.width || image.naturalHeight!==dimensions.height) throw new Error('size');
    } catch {throw new Error('バックアップの写真を読み込めません。写真を選び直して再試行してください。');}
    finally {URL.revokeObjectURL(url);}
  }
  return bytes;
}
