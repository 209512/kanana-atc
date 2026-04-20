let transientImages: string[] = [];

export const setTransientImage = (img: string | null) => { 
  if (img) transientImages.push(img);
  else transientImages = [];
};

export const getTransientImage = () => transientImages.shift() || null;