import React from "react"
import { Button, Typography } from "antd"
import "./App.less"

class Explanation extends React.Component {
  constructor(props) {
    super(props)
    this.state = { disabled: false }
  }

  onClick() {
    this.setState({ disabled: true })
    this.props.askNewQuestion()
  }

  render() {
    return (
      <div className={"sail-chat-bubble"}>
        <p
          style={{
            fontWeight: "500",
            fontSize: "1.2em",
            marginBottom: "0px",
          }}
        >
          Explanation
        </p>
        <Typography.Paragraph ellipsis={{ rows: 5, expandable: true, symbol: 'more' }}>
          {this.props.explanation}
        </Typography.Paragraph>
        <Button
          onClick={this.onClick.bind(this)}
          type="primary"
          disabled={this.state.disabled}
          style={{ marginTop: "-10px", marginBottom: "10px" }}
        >
          Next question
        </Button>
      </div>
    )
  }
}

export default Explanation
