import React, { useState } from 'react';

export interface WizardStep {
  title: string;
  content: React.ReactNode;
}

export interface WizardProps {
  steps: WizardStep[];
  onComplete: () => void;
  colors?: string[];
}

const DEFAULT_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7'];

export const Wizard: React.FC<WizardProps> = ({
  steps,
  onComplete,
  colors = DEFAULT_COLORS
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const getStepColor = (stepIndex: number) => {
    return colors[stepIndex % colors.length] || colors[0];
  };

  return (
    <div className="wizard">
      {/* Step Indicators */}
      <div className="wizard-indicators">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={index} className="wizard-step-indicator">
              <div
                className="step-number"
                style={{
                  backgroundColor: isActive || isCompleted ? getStepColor(index) : '#f5f5f5',
                  borderColor: isActive || isCompleted ? getStepColor(index) : '#000000',
                  color: isActive || isCompleted ? '#ffffff' : '#000000',
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <div
                className="step-title"
                style={{
                  color: isActive ? getStepColor(index) : isUpcoming ? '#999999' : '#000000',
                  fontWeight: isActive ? 'bold' : 'normal',
                }}
              >
                {step.title}
              </div>
              {index < steps.length - 1 && (
                <div className="step-connector" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {steps[currentStep].content}
      </div>

      {/* Navigation Buttons */}
      <div className="wizard-navigation">
        {!isFirstStep && (
          <button
            onClick={handleBack}
            className="wizard-button wizard-button-back"
            type="button"
          >
            ← Back
          </button>
        )}

        <button
          onClick={handleNext}
          className={`wizard-button ${isLastStep ? 'wizard-button-done' : 'wizard-button-next'}`}
          type="button"
        >
          {isLastStep ? 'Done →' : 'Next →'}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .wizard {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .wizard-indicators {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 16px;
            border: 2px solid #000000;
            background: #ffffff;
            box-shadow: 4px 4px 0px #000000;
          }

          .wizard-step-indicator {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            position: relative;
            flex: 1;
          }

          .step-number {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid;
            border-radius: 0;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 2px 2px 0px #000000;
            transition: all 0.2s;
          }

          .step-number:hover {
            transform: translate(-2px, -2px);
            box-shadow: 4px 4px 0px #000000;
          }

          .step-title {
            font-size: 12px;
            text-align: center;
            max-width: 100px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .step-connector {
            position: absolute;
            top: 36px;
            left: 50%;
            width: 100%;
            height: 2px;
            background: #000000;
            z-index: -1;
          }

          .wizard-step-indicator:last-child .step-connector {
            display: none;
          }

          .wizard-content {
            padding: 24px;
            border: 2px solid #000000;
            background: #ffffff;
            box-shadow: 4px 4px 0px #000000;
            min-height: 200px;
          }

          .wizard-navigation {
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }

          .wizard-button {
            padding: 12px 24px;
            border: 2px solid #000000;
            border-radius: 0;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            background: #ffffff;
            box-shadow: 4px 4px 0px #000000;
            transition: all 0.1s;
          }

          .wizard-button:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0px #000000;
          }

          .wizard-button:active {
            transform: translate(2px, 2px);
            box-shadow: 0px 0px 0px #000000;
          }

          .wizard-button-back {
            background: #f5f5f5;
          }

          .wizard-button-next {
            background: #ffffff;
          }

          .wizard-button-done {
            background: #22c55e;
            color: #ffffff;
          }

          .wizard-button-done:hover {
            background: #16a34a;
          }
        `
      }} />
    </div>
  );
};
