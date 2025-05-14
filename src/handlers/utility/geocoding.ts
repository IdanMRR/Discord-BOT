import axios from 'axios';

// City data interface
export interface CityData {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Fetches coordinates for a city using the OpenCage geocoding API
 * @param city City name
 * @param country Country name
 * @returns Promise with city data including coordinates
 */
export async function getCoordinates(city: string, country: string): Promise<CityData | null> {
  try {
    // Use OpenCage Geocoding API with a free API key
    const apiKey = '9cd710c79026433997a905c1b5a1ed79'; // Free OpenCage API key
    const query = encodeURIComponent(`${city}, ${country}`);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${apiKey}&limit=1`;
    
    console.log(`[GEOCODING] Fetching coordinates for ${city}, ${country}`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const coordinates = result.geometry;
      
      console.log(`[GEOCODING] Found coordinates for ${city}, ${country}: ${coordinates.lat}, ${coordinates.lng}`);
      
      return {
        name: city,
        country: country,
        lat: coordinates.lat,
        lon: coordinates.lng
      };
    }
    
    console.log(`[GEOCODING] No coordinates found for ${city}, ${country}`);
    return null;
  } catch (error) {
    console.error(`[GEOCODING] Error fetching coordinates for ${city}, ${country}:`, error);
    return null;
  }
}

/**
 * Default coordinates for frequently used cities
 * Fall back to these if geocoding fails
 */
export const defaultCoordinates: Record<string, CityData> = {
  'tel aviv': {
    name: 'Tel Aviv',
    country: 'Israel',
    lat: 32.0853,
    lon: 34.7818
  },
  'jerusalem': {
    name: 'Jerusalem',
    country: 'Israel',
    lat: 31.7683,
    lon: 35.2137
  },
  'haifa': {
    name: 'Haifa',
    country: 'Israel',
    lat: 32.7940,
    lon: 34.9896
  },
  'new york': {
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lon: -74.0060
  },
  'london': {
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278
  },
  'paris': {
    name: 'Paris',
    country: 'France',
    lat: 48.8566,
    lon: 2.3522
  },
  'tokyo': {
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503
  },
  'sydney': {
    name: 'Sydney', 
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093
  },
  'dubai': {
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.2048,
    lon: 55.2708
  },
  'berlin': {
    name: 'Berlin',
    country: 'Germany',
    lat: 52.5200,
    lon: 13.4050
  }
}; 

/**
 * List of common countries for autocomplete
 */
export const commonCountries = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia',
  'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada',
  'China', 'Czech Republic', 'Denmark', 'Egypt', 'Finland',
  'France', 'Germany', 'Greece', 'Hungary', 'India',
  'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Japan', 'Jordan', 'Kenya', 'Lebanon',
  'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand',
  'Nigeria', 'Norway', 'Pakistan', 'Philippines', 'Poland',
  'Portugal', 'Romania', 'Russia', 'Saudi Arabia', 'Singapore',
  'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
  'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
  'United States', 'Vietnam'
]; 