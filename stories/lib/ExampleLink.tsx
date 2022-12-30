import React from 'react'

export const ExampleLink = ({ example }: { example: () => JSX.Element }) => {
  return (
    <>
      The full code for this example can be found{' '}
      <a target="_blank" href={`${EXAMPLES_PATH}/${example.name}.tsx`}>
        here
      </a>
      .
    </>
  )
}

const EXAMPLES_PATH =
  'https://github.com/liao-frank/rooms/blob/main/stories/examples'
