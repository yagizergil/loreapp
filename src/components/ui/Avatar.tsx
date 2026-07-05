import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { getAvatarEmoji, getAvatarBg } from '../../lib/avatar';
import { genderColor } from '../../lib/genderColors';
import { Gender } from '../../lib/storage';

interface Props {
  avatarKey: string;
  avatarUrl?: string | null;
  gender?: Gender | null;
  size?: number;
  ring?: boolean;
}

export default function Avatar({ avatarKey, avatarUrl, gender, size = 48, ring = true }: Props) {
  const innerSize = Math.round(size * 0.8);
  const emojiSize = Math.round(innerSize * 0.56);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring ? 2 : 0,
        borderColor: genderColor(gender),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: getAvatarBg(avatarKey),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.3 }}>
            {getAvatarEmoji(avatarKey)}
          </Text>
        </View>
      )}
    </View>
  );
}
