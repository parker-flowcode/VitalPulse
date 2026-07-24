import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

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
import { useTheme } from '../theme/ThemeContext';

const Tab        = createBottomTabNavigator();
const HomeStack  = createStackNavigator();
const RootStack  = createStackNavigator();

const TAB_ICONS = {
  Inicio:     { active: '❤️', inactive: '🤍' },
  Historial:  { active: '📋', inactive: '📋' },
  'Análisis': { active: '📈', inactive: '📈' },
  Ajustes:    { active: '⚙️', inactive: '⚙️' },
};

function TabIcon({ name, focused }) {
  const icons = TAB_ICONS[name] || { active: '●', inactive: '○' };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {focused ? icons.active : icons.inactive}
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
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? '';
        const hideTabBar = routeName === 'Measure';
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            paddingBottom: 6,
            height: 60,
            display: hideTabBar ? 'none' : 'flex',
          },
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        };
      }}
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
  const { colors } = useTheme();
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 64, height: 64, marginBottom: 16, resizeMode: 'contain' }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
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
