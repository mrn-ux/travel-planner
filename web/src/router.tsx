import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Shell } from './components/Shell';
import BookingPage from './pages/booking/BookingPage';
import HomePage from './pages/home/HomePage';
import HotelPage from './pages/hotel/HotelPage';
import AuthCompletePage from './pages/login/AuthCompletePage';
import LoginPage from './pages/login/LoginPage';
import SearchPage from './pages/search/SearchPage';
import TripPlannerPage from './pages/trip/TripPlannerPage';
import MyTripsPage from './pages/trips/MyTripsPage';

// The seven routes of the application (docs/UI-SPEC.md section 1) and no others.
// Every route except /login is rendered inside the Shell (the fixed top navigation bar), and every one needs a signed-in user.
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/complete', element: <AuthCompletePage /> },
  {
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/trip/:tripId', element: <TripPlannerPage /> },
      { path: '/hotels/:hotelId', element: <HotelPage /> },
      {
        path: '/trip/:tripId/book/:hotelId',
        element: (
          <RequireAuth>
            <BookingPage />
          </RequireAuth>
        ),
      },
      {
        path: '/trips',
        element: (
          <RequireAuth>
            <MyTripsPage />
          </RequireAuth>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
