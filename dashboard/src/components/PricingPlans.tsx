import { useState } from 'react';

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  price: number;
  period: string;
  description: string;
  features: PricingFeature[];
  cta: string;
  popular?: boolean;
  stripePriceId?: string;
  aiGenerations: number;
}

export default function PricingPlans() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const plans: PricingPlan[] = [
    {
      name: 'Starter',
      price: billingPeriod === 'monthly' ? 9 : 7,
      period: billingPeriod === 'monthly' ? '/month' : '/month (billed yearly)',
      description: 'Perfect for individual developers',
      popular: true,
      aiGenerations: 50,
      stripePriceId: billingPeriod === 'monthly' ? 'price_starter_monthly' : 'price_starter_yearly',
      features: [
        { text: '50 AI generations per month', included: true },
        { text: 'Priority generation queue', included: true },
        { text: 'Email support', included: true },
      ],
      cta: 'Start Free Trial',
    },
    {
      name: 'Pro',
      price: billingPeriod === 'monthly' ? 29 : 24,
      period: billingPeriod === 'monthly' ? '/month' : '/month (billed yearly)',
      description: 'For professionals building regularly',
      aiGenerations: 200,
      stripePriceId: billingPeriod === 'monthly' ? 'price_pro_monthly' : 'price_pro_yearly',
      features: [
        { text: '200 AI generations per month', included: true },
        { text: 'Everything in Starter', included: true },
        { text: 'Advanced AI models', included: true },
        { text: 'Priority support', included: true },
      ],
      cta: 'Start Free Trial',
    },
    {
      name: 'Team',
      price: billingPeriod === 'monthly' ? 99 : 82,
      period: billingPeriod === 'monthly' ? '/month' : '/month (billed yearly)',
      description: 'For teams and organizations',
      aiGenerations: 1000,
      stripePriceId: billingPeriod === 'monthly' ? 'price_team_monthly' : 'price_team_yearly',
      features: [
        { text: '1000 AI generations per month', included: true },
        { text: 'Everything in Pro', included: true },
        { text: 'Team collaboration', included: true },
        { text: 'Dedicated support', included: true },
      ],
      cta: 'Start Free Trial',
    },
  ];

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!plan.stripePriceId) return;

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          planName: plan.name,
        }),
      });

      const { url } = await response.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to start subscription. Please try again.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-text-primary mb-3">
            AI Generation Pricing
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Pay only for AI-powered component generation. All templates are free.
          </p>

          <div className="inline-flex items-center bg-surface-2 rounded-lg p-1 border border-border">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-accent-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-accent-500 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Yearly
              <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-surface-1 rounded-xl p-6 border transition-all ${
                plan.popular
                  ? 'border-accent-500 shadow-lg'
                  : 'border-border hover:border-border-hover'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-accent-500 text-white px-3 py-1 rounded-full text-[11px] font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-1">{plan.name}</h3>
                <p className="text-[12px] text-text-tertiary mb-4">{plan.description}</p>
                <div className="flex items-baseline mb-2">
                  <span className="text-3xl font-bold text-text-primary">${plan.price}</span>
                  <span className="text-[12px] text-text-tertiary ml-2">{plan.period}</span>
                </div>
                <div className="text-[11px] text-text-secondary">
                  {plan.aiGenerations} AI generations/month
                </div>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-[12px]">
                    <svg
                      className="w-4 h-4 text-emerald-400 mr-2 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-text-secondary">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                className={`w-full py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  plan.popular
                    ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-sm'
                    : 'bg-surface-2 hover:bg-surface-3 text-text-primary border border-border'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-surface-1 rounded-xl p-8 border border-border mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg className="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-lg font-semibold text-text-primary">
              Powered by Claude by Anthropic
            </h2>
          </div>
          <p className="text-[13px] text-text-secondary text-center max-w-2xl mx-auto">
            Our AI generation feature uses Claude, Anthropic's advanced language model, to create high-quality 
            agents, commands, and skills tailored to your needs. Pricing reflects the actual API costs.
          </p>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-3">
            Questions?
          </h2>
          <p className="text-[13px] text-text-secondary mb-4">
            All templates, browsing, and downloads are completely free. You only pay for AI-powered generation.
          </p>
          <a
            href="mailto:support@aitmpl.com"
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-primary rounded-lg text-[13px] font-medium transition-all border border-border"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
