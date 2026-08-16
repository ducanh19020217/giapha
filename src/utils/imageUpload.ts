// Resize ảnh ở trình duyệt trước khi gửi lên backend, để dù ảnh gốc vài MB
// thì dữ liệu upload thực tế vẫn chỉ còn vài chục-trăm KB.

const TARGET_MAX_DIMENSION = 500;
const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.82;

function supportsWebPEncoding(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

export function resizeImageToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File không phải ảnh hợp lệ'));
      img.onload = () => {
        let { width, height } = img;
        if (width > TARGET_MAX_DIMENSION || height > TARGET_MAX_DIMENSION) {
          if (width >= height) {
            height = Math.round((height * TARGET_MAX_DIMENSION) / width);
            width = TARGET_MAX_DIMENSION;
          } else {
            width = Math.round((width * TARGET_MAX_DIMENSION) / height);
            height = TARGET_MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const useWebP = supportsWebPEncoding();
        const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
        const quality = useWebP ? WEBP_QUALITY : JPEG_QUALITY;
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(',')[1];
        if (!base64) {
          reject(new Error('Không xử lý được ảnh'));
          return;
        }
        resolve({ base64, mimeType });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
