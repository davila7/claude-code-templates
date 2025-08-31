import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
  command?: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Quick Setup',
    icon: '⚡',
    command: 'npm install -g claude-code-templates',
    description: (
      <>
        Install the CLI tool globally and get started with Claude Code templates 
        in seconds. No complex configuration required.
      </>
    ),
  },
  {
    title: 'Multi-Framework Support',
    icon: '🔧',
    description: (
      <>
        Templates for React, Vue, Angular, Django, FastAPI, Rails, and more. 
        Each includes optimized <code>CLAUDE.md</code> configurations and best practices.
      </>
    ),
  },
  {
    title: 'Real-time Analytics',
    icon: '📊',
    command: 'claude-code-templates --analytics',
    description: (
      <>
        Monitor your Claude Code usage with our comprehensive analytics dashboard. 
        Track sessions, token usage, and performance metrics in real-time.
      </>
    ),
  },
];

function Feature({title, icon, description, command}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>
          {icon}
        </div>
        <div className={styles.featureContent}>
          <Heading as="h3" className={styles.featureTitle}>{title}</Heading>
          <p className={styles.featureDescription}>{description}</p>
          {command && (
            <div className={styles.terminalCommand}>
              <span className={styles.prompt}>$</span>
              <code className={styles.command}>{command}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
