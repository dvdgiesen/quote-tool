import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, IconName } from '../../shared/icons/icon.component';
import { LogoLinkComponent } from '../../shared/logo/logo-link.component';

interface Expectation {
  icon: IconName;
  title: string;
  description: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LogoLinkComponent],
  template: `
    <main class="landing">

      <!-- Logo bar -->
      <div class="landing__logo-bar">
        <div class="container">
          <app-logo-link />
        </div>
      </div>

      <!-- Hero -->
      <section class="landing__hero glow-bg">
        <div class="container container--narrow">
          <span class="section-label">Instant Offerte Tool</span>
          <h1 class="landing__title">
            Ontvang direct een<br/>
            <span class="text-gradient">prijsindicatie</span>
          </h1>
          <p class="landing__subtitle">
            Upload je projectbrief en ontvang binnen enkele seconden een GenAI-gegenereerde prijsindicatie.
            Geen wachten, geen heen-en-weer — gewoon een direct startpunt voor ons gesprek.
          </p>
          <a routerLink="/auth" class="btn btn--primary landing__cta">
            Vraag je gratis offerte aan
            <app-icon name="arrow-right" [size]="16" />
          </a>
        </div>
      </section>

      <!-- How it works -->
      <section class="landing__steps">
        <div class="container">
          <span class="section-label">Hoe het werkt</span>
          <h2>Drie stappen naar jouw indicatie</h2>
          <div class="landing__steps-grid">
            @for (step of steps; track step.number) {
              <div class="landing__step card">
                <span class="landing__step-number">{{ step.number }}</span>
                <h3>{{ step.title }}</h3>
                <p>{{ step.description }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- What to expect -->
      <section class="landing__expect">
        <div class="container container--narrow">
          <span class="section-label">Wat je krijgt</span>
          <h2>Een helder startpunt</h2>
          <div class="landing__expect-grid">
            @for (item of expectations; track item.icon) {
              <div class="landing__expect-item">
                <span class="landing__expect-icon" aria-hidden="true">
                  <app-icon [name]="item.icon" [size]="22" />
                </span>
                <div>
                  <h4>{{ item.title }}</h4>
                  <p>{{ item.description }}</p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Disclaimer + CTA -->
      <section class="landing__bottom">
        <div class="container container--narrow">
          <div class="landing__disclaimer card">
            <span class="landing__disclaimer-icon" aria-hidden="true">
              <app-icon name="lightbulb" [size]="22" />
            </span>
            <div>
              <h3>Een richtlijn, geen bindende offerte</h3>
              <p>
                Dit hulpmiddel genereert een GenAI-gestuurde indicatie op basis van jouw brief. Het is een startpunt —
                geen definitieve prijs. Na het bekijken van je brief neem ik persoonlijk contact op binnen 24 uur
                om je project te bespreken en de exacte scope en prijs af te stemmen.
              </p>
            </div>
          </div>
          <div class="landing__final-cta">
            <a routerLink="/auth" class="btn btn--primary">
              Upload je brief
            </a>
            <a href="https://watsturen.nl/contact" class="btn btn--outline" target="_blank" rel="noopener noreferrer">
              Neem direct contact op
            </a>
          </div>
        </div>
      </section>

    </main>
  `,
  styles: [`
    :host { display: block; }

    .landing__logo-bar {
      padding-block: var(--space-6);
    }

    .landing__hero {
      min-height: 80vh;
      display: flex;
      align-items: center;
      padding-block: var(--section-py);
    }

    .landing__title {
      margin-bottom: var(--space-6);
      line-height: 1.1;
    }

    .landing__subtitle {
      font-size: var(--text-xl);
      color: var(--color-text-muted);
      max-width: 55ch;
      margin-bottom: var(--space-8);
    }

    .landing__cta {
      font-size: var(--text-lg);
      padding: var(--space-4) var(--space-8);
    }

    .landing__steps {
      padding-block: var(--section-py);
    }

    .landing__steps h2 {
      margin-bottom: var(--space-12);
    }

    .landing__steps-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-6);
    }

    .landing__step {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .landing__step h3 {
      font-size: var(--text-xl);
    }

    .landing__step-number {
      font-size: var(--text-5xl);
      font-weight: var(--font-extrabold);
      background: var(--gradient-text);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }

    .landing__expect {
      padding-block: var(--section-py);
    }

    .landing__expect h2 {
      margin-bottom: var(--space-10);
    }

    .landing__expect-grid {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .landing__expect-item {
      display: flex;
      gap: var(--space-4);
      align-items: flex-start;
    }

    .landing__expect-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: rgba(99, 102, 241, 0.08);
      color: var(--color-primary);
      margin-top: 2px;
    }

    .landing__expect-item h4 {
      font-size: var(--text-lg);
      margin-bottom: var(--space-1);
    }

    .landing__expect-item p {
      margin: 0;
    }

    .landing__bottom {
      padding-block: var(--section-py);
    }

    .landing__disclaimer {
      display: flex;
      gap: var(--space-4);
      align-items: flex-start;
      margin-bottom: var(--space-8);
      border-color: rgba(99, 102, 241, 0.2);
      background: rgba(99, 102, 241, 0.05);
    }

    .landing__disclaimer-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: rgba(99, 102, 241, 0.1);
      color: var(--color-primary);
    }

    .landing__disclaimer h3 {
      font-size: var(--text-lg);
      margin-bottom: var(--space-2);
    }

    .landing__disclaimer p {
      margin: 0;
    }

    .landing__final-cta {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
  `],
})
export class LandingComponent {
  readonly steps = [
    {
      number: '01',
      title: 'Maak een account aan',
      description: 'Log in met Google of maak een gratis account aan met je e-mailadres. E-mailverificatie is vereist.',
    },
    {
      number: '02',
      title: 'Upload je brief',
      description: 'Upload een PDF of Word-document met een beschrijving van je project — functies, doelen, tijdlijn en eventuele technische vereisten.',
    },
    {
      number: '03',
      title: 'Ontvang je indicatie',
      description: 'Onze GenAI leest je brief, extraheert de belangrijkste details en genereert direct een prijsrange op basis van scope en complexiteit.',
    },
  ];

  readonly expectations: Expectation[] = [
    {
      icon: 'euro',
      title: 'Prijsrange in EUR',
      description: 'Een realistische min–max indicatie op basis van €65/uur, projecttype, complexiteit en de functies in je brief.',
    },
    {
      icon: 'list',
      title: 'Functie-overzicht',
      description: 'Een lijst van de functies en vereisten die uit je brief zijn gehaald, zodat je precies ziet wat er is meegenomen.',
    },
    {
      icon: 'clock',
      title: 'Geschatte uren',
      description: 'De geschatte ontwikkeltijd, zodat je inzicht krijgt in de omvang van het werk.',
    },
    {
      icon: 'mail',
      title: 'E-mailbevestiging',
      description: 'Je ontvangt een kopie van je indicatie per e-mail. Ik ontvang ook je brief en neem binnen 24 uur contact op.',
    },
  ];
}
