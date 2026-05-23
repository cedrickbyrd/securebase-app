import { CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackAddToCart } from '../utils/analytics';

/**
 * Reusable one-time add-on product card for the Pricing page.
 *
 * @param {string}   planId    - Canonical plan key (e.g. 'pilot_compliance')
 * @param {string}   title     - Card heading
 * @param {string}   tagline   - Short descriptor below the title
 * @param {number}   price     - One-time price in USD (numeric)
 * @param {string[]} features  - Bullet-point feature list
 * @param {string}   ctaLabel  - CTA button text (e.g. 'Get Started')
 */
export default function AddOnCard({ planId, title, tagline, price, features, ctaLabel }) {
  const navigate = useNavigate();

  const handleClick = () => {
    trackAddToCart(planId, title, price);
    navigate(`/checkout?plan=${planId}&planName=${encodeURIComponent(title)}`);
  };

  return (
    <div className="bg-white border-2 border-teal-200 rounded-2xl p-8 shadow-sm flex flex-col">
      <div className="mb-6">
        <span className="inline-flex items-center bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-full mb-3">
          One-time purchase
        </span>
        <h3 className="text-2xl font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600">{tagline}</p>
      </div>
      <div className="mb-8">
        <span className="text-5xl font-black text-slate-900">${price.toLocaleString()}</span>
        <span className="text-sm ml-2 text-slate-500">one-time</span>
      </div>
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-600" />
            <span className="text-sm text-slate-600">{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={handleClick}
        className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-teal-500 to-green-500 text-white hover:shadow-lg hover:scale-105"
      >
        {ctaLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
