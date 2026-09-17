import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { MapPin, Navigation, X } from 'lucide-react-native';
import darkMapStyle from '../../theme/dark-map-style.json';
import { ActivityLocation } from '../../services/room';

interface VenueLocationModalProps {
  visible: boolean;
  onClose: () => void;
  venueName: string | null | undefined;
  coordinates: ActivityLocation | null | undefined;
  isLoading?: boolean;
}

export function VenueLocationModal({
  visible,
  onClose,
  venueName,
  coordinates,
  isLoading = false,
}: VenueLocationModalProps) {
  const handleOpenMaps = () => {
    if (!coordinates) return;
    const { latitude, longitude } = coordinates;
    const label = encodeURIComponent(venueName || 'Squad Venue');
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    if (url) {
      void Linking.openURL(url);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 items-center justify-center p-5">
        <View className="w-full max-w-md bg-ink border border-hairline rounded-3xl p-5 overflow-hidden shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-signal-violet/20 items-center justify-center mr-2.5">
                <MapPin size={16} color="#C77DFF" />
              </View>
              <View>
                <Text className="text-moonlight font-display font-bold text-base">
                  Exact Venue Location
                </Text>
                <Text className="text-dusk text-2xs font-mono">
                  Revealed only to accepted squad members
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close Venue Modal"
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-ink-raised items-center justify-center border border-hairline"
            >
              <X size={16} color="#A99BC2" />
            </TouchableOpacity>
          </View>

          {/* Venue Name Card */}
          <View className="bg-void p-3 rounded-2xl border border-hairline mb-4">
            <Text className="text-moonlight font-bold text-sm mb-0.5">
              {venueName || 'Designated Meetup Spot'}
            </Text>
            {coordinates ? (
              <Text className="text-dusk text-2xs font-mono">
                {coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}
              </Text>
            ) : null}
          </View>

          {/* Mini Map Canvas */}
          <View className="w-full h-52 rounded-2xl overflow-hidden border border-hairline mb-4 bg-void items-center justify-center">
            {isLoading ? (
              <ActivityIndicator color="#C77DFF" size="small" />
            ) : coordinates ? (
              <MapView
                provider={PROVIDER_DEFAULT}
                customMapStyle={darkMapStyle}
                style={{ width: '100%', height: '100%' }}
                initialRegion={{
                  latitude: coordinates.latitude,
                  longitude: coordinates.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
                showsCompass={false}
                showsTraffic={false}
                showsIndoors={false}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: coordinates.latitude,
                    longitude: coordinates.longitude,
                  }}
                  tracksViewChanges={false}
                >
                  <View className="w-8 h-8 rounded-full bg-signal-violet items-center justify-center border-2 border-moonlight shadow-lg">
                    <MapPin size={16} color="#0D0B14" />
                  </View>
                </Marker>
              </MapView>
            ) : (
              <Text className="text-dusk text-xs">Coordinates unavailable</Text>
            )}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open in Maps"
            disabled={!coordinates}
            onPress={handleOpenMaps}
            className={`w-full py-3.5 bg-signal-violet rounded-full flex-row items-center justify-center shadow-lg active:scale-95 ${
              !coordinates ? 'opacity-40' : ''
            }`}
            activeOpacity={0.8}
          >
            <Navigation size={16} color="#0D0B14" style={{ marginRight: 8 }} />
            <Text className="text-void font-display font-bold text-sm">
              Open in Maps
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
