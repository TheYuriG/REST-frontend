import React, { Component } from 'react';

import Image from '../../../components/Image/Image';
import './SinglePost.css';
//? Import the server URL
import { server } from '../../../util/server.js';

class SinglePost extends Component {
	state = {
		title: '',
		author: '',
		date: '',
		image: '',
		content: '',
	};

	componentDidMount() {
		//? Extract the post ID from the URL
		const postId = this.props.match.params.postId;

		//? Construct the GraphQL query using the postId
		const graphqlSinglePostQuery = {
			query: `
                {
                    singlePost(ID: "${postId}") {
                        _id
                        title
                        content
                        imageUrl
                        creator {
                            name
                        }
                        createdAt
                    }
                }`,
		};

		//? Make a POST request to the GraphQL endpoint to get the post data
		fetch(server + '/graphql', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + this.props.token,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(graphqlSinglePostQuery),
		})
			.then((res) => {
				return res.json();
			})
			.then(({errors, data: { singlePost: { title, creator: { name: author }, imageUrl, createdAt: date, content}}}) => {
				//? Check specifically if the server returned an
				//? Unauthorized status code and throw that error
				if (errors) {
					if (errors?.[0]?.status === 401) {
						throw new Error('Failed to fetch post, you are not authenticated!');
					}

					//? If not, then throw the default error message
					throw new Error('Unable to retrieve post!');
				}

				//? Set the data on the UI for the user
				this.setState({
					title,
					author,
					image: server + '/' + imageUrl,
					date,
					content,
				});
			})
			.catch((err) => {
				console.log(err);
			});
	}

	render() {
		return (
			<section className="single-post">
				<h1>{this.state.title}</h1>
				<h2>
					Created by {this.state.author} on {this.state.date}
				</h2>
				<div className="single-post__image">
					<Image contain imageUrl={this.state.image} />
				</div>
				<p>{this.state.content}</p>
			</section>
		);
	}
}

export default SinglePost;
