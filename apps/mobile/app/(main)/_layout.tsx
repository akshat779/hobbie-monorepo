import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Map, Rss, Users, User } from 'lucide-react-native';

export default function MainTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#17131F',
          borderTopColor: '#2C2739',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#C77DFF',
        tabBarInactiveTintColor: '#A99BC2',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hobbie',
          tabBarIcon: ({ color }) => <Map color={color} size={20} />,
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              Hobbie
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="list"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Rss color={color} size={20} />,
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              Feed
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="my-activities"
        options={{
          title: 'My Squads',
          tabBarIcon: ({ color }) => <Users color={color} size={20} />,
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              My Squads
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={20} />,
          tabBarLabel: ({ color }) => (
            <Text style={{ color, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
              Profile
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
