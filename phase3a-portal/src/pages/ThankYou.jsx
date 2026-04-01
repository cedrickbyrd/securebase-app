import React from 'react';

const ThankYou = () => {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-4xl font-bold text-white mb-4">Thank You!</h1>
      <p className="text-xl text-blue-100 mb-8 max-w-lg">
        We&apos;ve received your request and will be in touch within 24 hours.
        In the meantime, feel free to schedule a call with our team.
      </p>
      <a
        href="https://calendly.com/cedrickjbyrd/white-glove-pilot"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 px-8 rounded-lg text-lg shadow-lg transition mb-6"
      >
        📅 Schedule a Demo Call
      </a>
      <a
        href="/"
        className="text-blue-200 hover:text-white underline text-sm transition"
      >
        ← Back to Home
      </a>
    </div>
  );
};

export default ThankYou;
