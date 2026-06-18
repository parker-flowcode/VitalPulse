import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen       from '../screens/HomeScreen';
import MeasureScreen    from '../screens/MeasureScreen';
import ResultsScreen    from '../screens/ResultsScreen';
import HistoryScreen    from '../screens/HistoryScreen';
import AnalyticsScreen  from '../screens/AnalyticsScreen';
import SettingsScreen   from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsScreen        from '../screens/TermsScreen';
import CalibrationScreen from '../screens/CalibrationScreen';
import TutorialScreen  from '../screens/TutorialScreen';
import UpgradeScreen   from '../screens/UpgradeScreen';
import useHealthStore   from '../store/healthstore';

const Tab        = createBottomTabNavigator();
const HomeStack  = createStackNavigator();
const RootStack  = createStackNavigator();

function TabIcon({ name, focused }) {
  const icons = {
    Inicio:   '🏠',
    Historial:'📋',
    Análisis: '📈',
    Ajustes:  '⚙️',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[name] || '●'}
    </Text>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"  component={HomeScreen} />
      <HomeStack.Screen name="Measure"   component={MeasureScreen} />
      <HomeStack.Screen name="Results"   component={ResultsScreen} />
    </HomeStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F1F1E',
          borderTopColor: '#1A7F6E33',
          paddingBottom: 6,
          height: 60,
        },
        tabBarActiveTintColor:   '#2BBFA4',
        tabBarInactiveTintColor: '#4A6A67',
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Inicio"    component={HomeStackNavigator} />
      <Tab.Screen name="Historial" component={HistoryScreen} />
      <Tab.Screen name="Análisis"  component={AnalyticsScreen} />
      <Tab.Screen name="Ajustes"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { onboardingDone, loadAll } = useHealthStore();
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0D1918', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2BBFA4" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current: { progress } }) => ({
            cardStyle: {
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          }),
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 300 } },
            close: { animation: 'timing', config: { duration: 250 } },
          },
        }}
      >
        {!onboardingDone ? (
          // Primera vez: mostrar onboarding
          <RootStack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ animationTypeForReplace: 'push' }}
          />
        ) : null}
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <RootStack.Screen name="Terms" component={TermsScreen} />
        <RootStack.Screen name="Calibration" component={CalibrationScreen} />
        <RootStack.Screen name="Tutorial" component={TutorialScreen} />
        <RootStack.Screen name="Upgrade" component={UpgradeScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
