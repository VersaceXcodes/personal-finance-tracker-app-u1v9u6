import React from 'react';
import { Link } from 'react-router-dom';

const UV_Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-900">
          Welcome to FinTracker
        </h1>
        <div className="mt-8 flex justify-center">
          <Link
            to="/login"
            className="mx-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="mx-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UV_Landing;