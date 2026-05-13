import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export async function pickAndUploadThumbnail() {
  try {
    // Request permission
    const permissionResult = 
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      throw new Error('Permission to access photos denied');
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    const uri = result.assets[0].uri;
    
    // Convert to base64
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Upload to backend
    const uploadResponse = await api.post('/upload-thumbnail', {
      image: base64,
      filename: `thumbnail-${Date.now()}.jpg`
    });

    return uploadResponse.data.url;

  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    throw error;
  }
}