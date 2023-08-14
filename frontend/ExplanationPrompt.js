import React from "react"
import { Button } from "antd"
import "./App.less"

class ExplanationPrompt extends React.Component {
  constructor(props) {
    super(props)
    this.state = { disabled: false }
  }

  onClick(yes) {
    const { showExplanation, askNewQuestion } = this.props
    this.setState({ disabled: true })
    if (yes) {
      showExplanation()
    } else {
      askNewQuestion()
    }
  }

  render() {
    return (
      <div>
        <Button
          onClick={this.onClick.bind(this, true)}
          type="primary"
          disabled={this.state.disabled}
          style={{ marginTop: "-10px", marginBottom: "10px" }}
        >
          Yes
        </Button>
        <Button
          onClick={this.onClick.bind(this, false)}
          type="primary"
          disabled={this.state.disabled}
          style={{
            marginTop: "-10px",
            marginBottom: "10px",
            marginLeft: "10px",
          }}
        >
          No
        </Button>
      </div>
    )
  }
}

export default ExplanationPrompt
